import urllib.request
import urllib.parse
import json
from typing import Any, Dict
from ..registry import register, ToolError

@register("getWeather")
def get_weather(args: Dict[str, Any]) -> Dict[str, Any]:
    location = args.get("location", "")
    location = location.strip() or "Mumbai"
    try:
        encoded = urllib.parse.quote(location)
        url = f"https://wttr.in/{encoded}?format=j1"
        with urllib.request.urlopen(url, timeout=10) as resp:
            data = json.loads(resp.read().decode())
        curr = data["current_condition"][0]
        temp_c = curr["temp_C"]
        feels = curr["FeelsLikeC"]
        desc = curr["weatherDesc"][0]["value"]
        humidity = curr["humidity"]
        wind = curr["windspeedKmph"]
        return {
            "result": f"Weather in {location}: {desc}, {temp_c}°C (feels like {feels}°C). Humidity: {humidity}%, Wind: {wind} km/h.",
            "location": location,
            "temperature": temp_c,
            "description": desc,
            "humidity": humidity,
            "wind_speed": wind
        }
    except Exception as e:
        raise ToolError(f"Failed to fetch weather: {e}")
