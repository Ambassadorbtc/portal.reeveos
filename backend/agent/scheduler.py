"""
Rezvo Agent Scheduler
=====================
Integrates with the existing helpers/scheduler.py pattern.
Registers all agent tasks on their intervals.
Call start_agent_scheduler() from the main scheduler loop.
"""
import logging
from datetime import datetime, timedelta

logger = logging.getLogger("agent.scheduler")

_agent_running = False

# Task schedule: (task_name, interval_seconds, function, last_run)
_task_schedule = []


def _register_tasks():
    """Register all agent tasks with their intervals."""
    from agent.tasks.scheduled import (
        health_check,
        triage_tickets,
        moderate_reviews,
        daily_briefing,
        score_churn_risk,
        discover_leads,
        research_and_outreach_leads,
        process_dunning,
        generate_seo_content,
        process_onboarding_drip,
        learn_from_conversations,
    )
    from agent.tasks.outreach import (
        outreach_warmup_cycle,
        outreach_daily_advance,
        outreach_process_campaigns,
        outreach_health_scoring,
        outreach_campaign_status_check,
    )

    global _task_schedule
    _task_schedule = [
        # (name, interval_seconds, function, last_run, daily_only, run_at_hour)
        ("health_check",        5 * 60,         health_check,               None, False, None),
        ("ticket_triage",       15 * 60,        triage_tickets,             None, False, None),
        ("review_moderation",   2 * 60 * 60,    moderate_reviews,           None, False, None),
        ("onboarding_drip",     30 * 60,        process_onboarding_drip,    None, False, None),
        ("dunning",             4 * 60 * 60,    process_dunning,            None, False, None),
        ("daily_briefing",      24 * 60 * 60,   daily_briefing,             None, True,  8),  # 8 AM
        ("churn_scoring",       24 * 60 * 60,   score_churn_risk,           None, True,  6),  # 6 AM
        ("lead_discovery",      12 * 60 * 60,   discover_leads,             None, False, None),
        ("lead_research",       24 * 60 * 60,   research_and_outreach_leads, None, True, 10), # 10 AM
        ("seo_content",         24 * 60 * 60,   generate_seo_content,       None, True,  3),  # 3 AM
        ("knowledge_learning",  24 * 60 * 60,   learn_from_conversations,   None, True,  2),  # 2 AM
        # ═══ Outreach Engine Tasks ═══
        ("outreach_warmup",     2 * 60 * 60,    outreach_warmup_cycle,      None, False, None),   # Every 2h
        ("outreach_daily",      24 * 60 * 60,   outreach_daily_advance,     None, True,  0),      # Midnight
        ("outreach_campaigns",  30 * 60,        outreach_process_campaigns, None, False, None),    # Every 30m
        ("outreach_health",     6 * 60 * 60,    outreach_health_scoring,    None, False, None),    # Every 6h
        ("outreach_status",     60 * 60,        outreach_campaign_status_check, None, False, None), # Every 1h
    ]
    logger.info(f"Registered {len(_task_schedule)} agent tasks (including outreach engine)")


async def run_agent_tick():
    """
    Called from the main scheduler loop on each tick.
    Checks which tasks are due and runs them.
    """
    global _task_schedule, _agent_running
    
    if not _task_schedule:
        _register_tasks()
        # Register tools on first tick
        from agent.tools.all_tools import register_all_tools
        register_all_tools()
    
    if _agent_running:
        return  # Prevent overlapping runs
    
    _agent_running = True
    now = datetime.utcnow()
    
    try:
        for i, (name, interval, func, last_run, daily_only, run_hour) in enumerate(_task_schedule):
            # Skip if not due
            if last_run and (now - last_run).total_seconds() < interval:
                continue
            
            # For daily tasks, check if it's the right hour
            if daily_only and run_hour is not None:
                if now.hour != run_hour:
                    continue
                # Also skip if already ran today
                if last_run and last_run.date() == now.date():
                    continue
            
            # Run the task
            try:
                logger.info(f"Running agent task: {name}")
                result = await func()
                _task_schedule[i] = (name, interval, func, now, daily_only, run_hour)
                logger.info(f"Completed: {name} — {result}")
            except Exception as e:
                logger.error(f"Agent task '{name}' failed: {e}")
                # Still update last_run to avoid hammering on error
                _task_schedule[i] = (name, interval, func, now, daily_only, run_hour)
    
    finally:
        _agent_running = False


async def get_task_status():
    """Get status of all scheduled tasks for the dashboard."""
    return [
        {
            "name": name,
            "interval_minutes": interval // 60,
            "last_run": last_run.isoformat() if last_run else None,
            "daily_only": daily_only,
            "run_at_hour": run_hour,
        }
        for name, interval, _, last_run, daily_only, run_hour in _task_schedule
    ]
