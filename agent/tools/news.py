import urllib.request
import xml.etree.ElementTree as ET
from typing import Any, Dict
from ..registry import register, ToolError


@register("getNews")
def get_news(args: Dict[str, Any]) -> Dict[str, Any]:
    category = args.get("category", "top").strip().lower()
    count = min(int(args.get("count", 5)), 15)
    rss_urls = {
        "top": "https://news.google.com/rss?hl=en-IN&gl=IN&ceid=IN:en",
        "tech": "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGRqTVhZU0FtVnVHZ0pWVXlnQVAB?hl=en-IN&gl=IN&ceid=IN:en",
        "world": "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FtVnVHZ0pWVXlnQVAB?hl=en-IN&gl=IN&ceid=IN:en",
        "india": "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRFZxYUdjU0FtVnVHZ0pWVXlnQVAB?hl=en-IN&gl=IN&ceid=IN:en",
        "sports": "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRFp1ZEdvU0FtVnVHZ0pWVXlnQVAB?hl=en-IN&gl=IN&ceid=IN:en",
        "business": "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx6TVdZU0FtVnVHZ0pWVXlnQVAB?hl=en-IN&gl=IN&ceid=IN:en",
    }
    url = rss_urls.get(category, rss_urls["top"])
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            tree = ET.parse(resp)
        root = tree.getroot()
        items = root.findall(".//item")[:count]
        headlines = []
        for item in items:
            title = item.findtext("title", "")
            link = item.findtext("link", "")
            if title:
                headlines.append({"title": title, "link": link})
        summary = "\n".join(f"{i+1}. {h['title']}" for i, h in enumerate(headlines))
        return {
            "result": f"Top {len(headlines)} headlines:\n{summary}",
            "headlines": headlines,
            "category": category,
            "count": len(headlines),
        }
    except Exception as e:
        raise ToolError(f"Failed to fetch news: {e}")
