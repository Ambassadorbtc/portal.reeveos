from fastapi import APIRouter, Request
from middleware.rate_limit import limiter, HTTPException
from pydantic import BaseModel
from datetime import datetime, timedelta
from typing import Optional
import os
import anthropic

router = APIRouter(prefix="/api/voice-search", tags=["voice-search"])


class VoiceSearchRequest(BaseModel):
    transcript: str
    vertical: str = "restaurant"


class VoiceSearchResponse(BaseModel):
    cuisine: Optional[str] = None
    location: Optional[str] = None
    guests: Optional[int] = None
    date: Optional[str] = None
    time: Optional[str] = None
    business_type: str
    service: Optional[str] = None
    vibe: Optional[str] = None
    business_name: Optional[str] = None
    confidence: float = 0.0


@router.post("/parse", response_model=VoiceSearchResponse)
@limiter.limit("10/minute")
async def parse_voice_search(request: Request, voice_data: VoiceSearchRequest):
    """
    Parse voice search transcript using Claude Haiku to extract structured booking intent.
    
    Example: "Italian in Shoreditch for 4 Saturday night"
    Returns: { cuisine: "Italian", location: "Shoreditch", guests: 4, date: "2026-02-28", time: "19:00" }
    """
    
    # Get Anthropic API key from environment
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Anthropic API key not configured")
    
    try:
        client = anthropic.Anthropic(api_key=api_key)
        
        today = datetime.now().strftime("%Y-%m-%d")
        system_prompt = f"""You are a booking search parser for Rezvo, a UK booking platform.
Extract structured booking intent from the user's voice transcript.
Today's date is {today}. The user is in the UK.

Return ONLY valid JSON with these fields (use null if not mentioned):
- cuisine: string (e.g. "Italian", "Indian", "Thai") — for restaurants only
- location: string (city, area, or postcode)
- guests: number (default 2 if not mentioned and vertical is restaurant)
- date: string (YYYY-MM-DD format)
  - "tonight" or "today" → {today}
  - "tomorrow" → {(datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")}
  - "Saturday" or day name → find next occurrence
  - "this weekend" → next Saturday
  - "next week" → 7 days from now
- time: string (HH:MM 24-hour format)
  - "evening" or "dinner" or "tonight" → "19:00"
  - "lunch" → "12:30"
  - "breakfast" → "09:00"
  - "afternoon" → "15:00"
  - Specific time → convert to 24h
- business_type: string ("restaurant", "salon", "barber", "spa", "other")
- service: string or null (for salons/barbers/spas: "haircut", "massage", "fade", etc.)
- vibe: string or null ("romantic", "casual", "fine dining", "family friendly")
- business_name: string or null (if they mentioned a specific business name)
- confidence: float 0.0-1.0 (how confident you are in the parse)

Examples:
Input: "Italian in Shoreditch for 4 tonight"
Output: {{"cuisine": "Italian", "location": "Shoreditch", "guests": 4, "date": "{today}", "time": "19:00", "business_type": "restaurant", "service": null, "vibe": null, "business_name": null, "confidence": 0.95}}

Input: "barber near me tomorrow morning"
Output: {{"cuisine": null, "location": "near me", "guests": null, "date": "{(datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")}", "time": "10:00", "business_type": "barber", "service": "haircut", "vibe": null, "business_name": null, "confidence": 0.90}}

Input: "romantic sushi place for 2 Saturday evening"
Output: {{"cuisine": "Japanese", "location": null, "guests": 2, "date": "next Saturday", "time": "19:30", "business_type": "restaurant", "service": null, "vibe": "romantic", "business_name": null, "confidence": 0.92}}"""

        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=500,
            system=system_prompt,
            messages=[
                {
                    "role": "user",
                    "content": f"Transcript: {voice_data.transcript}\nVertical context: {voice_data.vertical}"
                }
            ]
        )
        
        # Extract JSON from response
        response_text = message.content[0].text.strip()
        
        # Remove markdown code blocks if present
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.startswith("```"):
            response_text = response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
        response_text = response_text.strip()
        
        # Parse JSON
        import json
        parsed = json.loads(response_text)
        
        # Convert "next Saturday" etc to actual dates if needed
        if parsed.get("date") and not parsed["date"].startswith("20"):
            parsed["date"] = resolve_relative_date(parsed["date"])
        
        return VoiceSearchResponse(**parsed)
        
    except anthropic.APIError as e:
        raise HTTPException(status_code=500, detail=f"Anthropic API error: {str(e)}")
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Failed to parse AI response")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Voice search parse error: {str(e)}")


def resolve_relative_date(date_str: str) -> str:
    """Convert relative date strings to YYYY-MM-DD format."""
    today = datetime.now()
    date_lower = date_str.lower()
    
    if "tonight" in date_lower or "today" in date_lower:
        return today.strftime("%Y-%m-%d")
    
    if "tomorrow" in date_lower:
        return (today + timedelta(days=1)).strftime("%Y-%m-%d")
    
    if "weekend" in date_lower or "saturday" in date_lower:
        days_ahead = (5 - today.weekday()) % 7
        if days_ahead == 0:
            days_ahead = 7
        return (today + timedelta(days=days_ahead)).strftime("%Y-%m-%d")
    
    if "sunday" in date_lower:
        days_ahead = (6 - today.weekday()) % 7
        if days_ahead == 0:
            days_ahead = 7
        return (today + timedelta(days=days_ahead)).strftime("%Y-%m-%d")
    
    if "next week" in date_lower:
        return (today + timedelta(days=7)).strftime("%Y-%m-%d")
    
    # Default: tomorrow
    return (today + timedelta(days=1)).strftime("%Y-%m-%d")
