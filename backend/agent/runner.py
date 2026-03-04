"""
ReeveOS Agent Runner — Claude tool-use orchestration loop
========================================================
Sends tasks to Claude with tool definitions, executes tool calls
through the guardrails layer, returns results, loops until done.
Uses Haiku for cheap tasks, Sonnet for complex reasoning.
"""
import json
import time
import logging
import httpx
from datetime import datetime
from typing import List, Dict, Any, Optional
from config import settings
from database import get_database

logger = logging.getLogger("agent.runner")

MODEL_HAIKU = "claude-haiku-4-5-20251001"
MODEL_SONNET = "claude-sonnet-4-20250514"

# Tool registry — populated by tool modules
TOOL_REGISTRY: Dict[str, Dict] = {}
TOOL_HANDLERS: Dict[str, Any] = {}


def register_tool(name: str, description: str, input_schema: dict, handler, tier: str = "auto"):
    """Register a tool with the agent. tier = auto|review|human"""
    TOOL_REGISTRY[name] = {
        "name": name,
        "description": description,
        "input_schema": input_schema,
        "tier": tier,
    }
    TOOL_HANDLERS[name] = handler


def get_tool_definitions() -> List[Dict]:
    """Get Claude-formatted tool definitions."""
    return [
        {"name": t["name"], "description": t["description"], "input_schema": t["input_schema"]}
        for t in TOOL_REGISTRY.values()
    ]


async def run_agent(
    task: str,
    system_prompt: str = None,
    model: str = None,
    tools: List[str] = None,
    max_turns: int = 10,
    task_type: str = "general",
) -> Dict[str, Any]:
    """
    Run the Claude agent loop for a task.
    
    Args:
        task: The task description / user message
        system_prompt: Override system prompt
        model: Override model (defaults to Haiku for cheap tasks)
        tools: List of tool names to make available (None = all)
        max_turns: Max tool-use loops before stopping
        task_type: For audit logging
    
    Returns:
        {"result": str, "tool_calls": list, "tokens_used": int, "duration": float}
    """
    if not settings.anthropic_api_key:
        return {"result": "AI not configured", "tool_calls": [], "tokens_used": 0, "duration": 0}

    model = model or MODEL_HAIKU
    start_time = time.time()
    
    # Filter tools if specified
    if tools:
        available_tools = [
            {"name": t["name"], "description": t["description"], "input_schema": t["input_schema"]}
            for name, t in TOOL_REGISTRY.items() if name in tools
        ]
    else:
        available_tools = get_tool_definitions()

    if not system_prompt:
        system_prompt = """You are ReeveOS's AI operations agent. You manage the platform autonomously.
Be concise and action-oriented. Use tools to gather data and take actions.
Always explain what you did and why. If something needs human attention, say so clearly."""

    messages = [{"role": "user", "content": task}]
    all_tool_calls = []
    total_tokens = 0
    text_blocks = []

    async with httpx.AsyncClient(timeout=60.0) as client:
        for turn in range(max_turns):
            body = {
                "model": model,
                "max_tokens": 2000,
                "system": system_prompt,
                "messages": messages,
            }
            if available_tools:
                body["tools"] = available_tools

            try:
                resp = await client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={
                        "x-api-key": settings.anthropic_api_key,
                        "anthropic-version": "2023-06-01",
                        "content-type": "application/json",
                    },
                    json=body,
                )
            except Exception as e:
                logger.error(f"Claude API error: {e}")
                text_blocks = [f"API connection error: {str(e)}"]
                break

            if resp.status_code != 200:
                logger.error(f"Claude API {resp.status_code}: {resp.text[:300]}")
                text_blocks = [f"Claude API returned {resp.status_code}. Check your ANTHROPIC_API_KEY in .env"]
                break

            data = resp.json()
            total_tokens += data.get("usage", {}).get("input_tokens", 0) + data.get("usage", {}).get("output_tokens", 0)

            # Check if we have tool use blocks
            tool_use_blocks = [b for b in data["content"] if b["type"] == "tool_use"]
            text_blocks = [b["text"] for b in data["content"] if b["type"] == "text"]

            if not tool_use_blocks:
                # No more tool calls — we're done
                result = "\n".join(text_blocks)
                duration = time.time() - start_time
                
                # Audit log
                await _audit_log(task_type, task, result, all_tool_calls, total_tokens, duration, model)
                
                return {
                    "result": result,
                    "tool_calls": all_tool_calls,
                    "tokens_used": total_tokens,
                    "duration": round(duration, 2),
                }

            # Process tool calls
            messages.append({"role": "assistant", "content": data["content"]})
            tool_results = []

            for tool_block in tool_use_blocks:
                tool_name = tool_block["name"]
                tool_input = tool_block["input"]
                tool_id = tool_block["id"]

                # Check guardrails
                from agent.guardrails.action_classifier import classify_action, check_rate_limit
                
                tier = TOOL_REGISTRY.get(tool_name, {}).get("tier", "auto")
                classification = classify_action(tool_name, tool_input, tier)

                if classification == "blocked":
                    tool_result = {"error": f"Action '{tool_name}' requires human approval. Logged for review."}
                    await _log_pending_approval(tool_name, tool_input, task)
                elif classification == "rate_limited":
                    tool_result = {"error": f"Rate limit exceeded for '{tool_name}'. Try again later."}
                else:
                    # Execute the tool
                    handler = TOOL_HANDLERS.get(tool_name)
                    if handler:
                        try:
                            if not check_rate_limit(tool_name):
                                tool_result = {"error": "Rate limit exceeded"}
                            else:
                                tool_result = await handler(**tool_input)
                        except Exception as e:
                            logger.error(f"Tool '{tool_name}' error: {e}")
                            tool_result = {"error": str(e)}
                    else:
                        tool_result = {"error": f"Unknown tool: {tool_name}"}

                all_tool_calls.append({
                    "tool": tool_name,
                    "input": tool_input,
                    "result": tool_result,
                    "tier": classification,
                    "timestamp": datetime.utcnow().isoformat(),
                })

                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": tool_id,
                    "content": json.dumps(tool_result) if isinstance(tool_result, dict) else str(tool_result),
                })

            messages.append({"role": "user", "content": tool_results})

    # Hit max turns
    duration = time.time() - start_time
    result = "\n".join(text_blocks) if text_blocks else "Agent reached max turns without completing."
    await _audit_log(task_type, task, result, all_tool_calls, total_tokens, duration, model)
    
    return {
        "result": result,
        "tool_calls": all_tool_calls,
        "tokens_used": total_tokens,
        "duration": round(duration, 2),
    }


async def _audit_log(task_type, task, result, tool_calls, tokens, duration, model):
    """Log every agent run to MongoDB for full audit trail."""
    try:
        db = get_database()
        if db is not None:
            await db.agent_audit.insert_one({
                "task_type": task_type,
                "task": task[:500],
                "result": result[:1000],
                "tool_calls_count": len(tool_calls),
                "tool_calls": tool_calls[:20],  # Cap stored calls
                "tokens_used": tokens,
                "duration_seconds": duration,
                "model": model,
                "created_at": datetime.utcnow(),
            })
    except Exception as e:
        logger.error(f"Audit log error: {e}")


async def _log_pending_approval(tool_name, tool_input, task):
    """Log actions that need human approval."""
    try:
        db = get_database()
        if db is not None:
            await db.agent_approvals.insert_one({
                "tool": tool_name,
                "input": tool_input,
                "task": task[:500],
                "status": "pending",
                "created_at": datetime.utcnow(),
            })
    except Exception as e:
        logger.error(f"Approval log error: {e}")
