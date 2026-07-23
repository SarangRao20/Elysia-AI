"""
Google Calendar, Gmail, and Tasks integration via OAuth 2.0.

Setup:
  1. Go to https://console.cloud.google.com/ → Create Project
  2. Enable APIs: Calendar API, Gmail API, Google Tasks API
  3. Create OAuth 2.0 credentials (Desktop application type)
  4. Download credentials.json
  5. Place at: ~/.elysia/google_oauth/credentials.json
  6. First tool call will open a browser for OAuth consent
  7. Token saved to ~/.elysia/google_oauth/token.json (auto-refreshed)
"""

from __future__ import annotations

import json
import os
import pickle
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict

from .registry import ToolError, register

# ---------------------------------------------------------------------------
# OAuth helpers
# ---------------------------------------------------------------------------

SCOPES = [
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/tasks",
]

_OAUTH_DIR = Path.home() / ".elysia" / "google_oauth"
_CREDENTIALS_PATH = _OAUTH_DIR / "credentials.json"
_TOKEN_PATH = _OAUTH_DIR / "token.pickle"

# Lazy-loaded service references
_calendar_service = None
_gmail_service = None
_tasks_service = None


def _ensure_credentials() -> Any:
    """Return an authenticated Google API credentials object.

    Raises ToolError if credentials.json is missing or auth fails.
    """
    if not _CREDENTIALS_PATH.exists():
        raise ToolError(
            "Google API not configured. "
            f"Place your OAuth credentials.json at: {_CREDENTIALS_PATH}\n\n"
            "Setup steps:\n"
            "1. Go to https://console.cloud.google.com/ → Create Project\n"
            "2. Enable: Calendar API, Gmail API, Google Tasks API\n"
            "3. Create OAuth 2.0 credentials (Desktop app type)\n"
            "4. Download credentials.json and save to ~/.elysia/google_oauth/"
        )

    import google.auth.exceptions
    from google.auth.transport.requests import Request as AuthRequest
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow

    creds = None
    if _TOKEN_PATH.exists():
        with open(_TOKEN_PATH, "rb") as f:
            creds = pickle.load(f)

    if creds and creds.expired and creds.refresh_token:
        try:
            creds.refresh(AuthRequest())
        except Exception as e:
            creds = None

    if not creds or not creds.valid:
        flow = InstalledAppFlow.from_client_secrets_file(
            str(_CREDENTIALS_PATH), SCOPES
        )
        creds = flow.run_local_server(port=0, open_browser=True)
        _OAUTH_DIR.mkdir(parents=True, exist_ok=True)
        with open(_TOKEN_PATH, "wb") as f:
            pickle.dump(creds, f)

    return creds


def _calendar():
    global _calendar_service
    if _calendar_service is None:
        from googleapiclient.discovery import build
        _calendar_service = build("calendar", "v3", credentials=_ensure_credentials())
    return _calendar_service


def _gmail():
    global _gmail_service
    if _gmail_service is None:
        from googleapiclient.discovery import build
        _gmail_service = build("gmail", "v1", credentials=_ensure_credentials())
    return _gmail_service


def _tasks():
    global _tasks_service
    if _tasks_service is None:
        from googleapiclient.discovery import build
        _tasks_service = build("tasks", "v1", credentials=_ensure_credentials())
    return _tasks_service


# ---------------------------------------------------------------------------
# Calendar tools
# ---------------------------------------------------------------------------


@register("getCalendarEvents")
def get_calendar_events(args: Dict[str, Any]) -> Dict[str, Any]:
    """List upcoming Google Calendar events.

    Args:
        max_results: Number of events to return (default 10)
        days_ahead: How many days ahead to look (default 7)
        show_all: Return all details including description/location (default false)
    """
    max_results = min(int(args.get("max_results", 10)), 50)
    days_ahead = max(1, int(args.get("days_ahead", 7)))
    show_all = bool(args.get("show_all", False))

    now = datetime.utcnow()
    time_min = now.isoformat() + "Z"
    time_max = (now + timedelta(days=days_ahead)).isoformat() + "Z"

    try:
        events_result = (
            _calendar()
            .events()
            .list(
                calendarId="primary",
                timeMin=time_min,
                timeMax=time_max,
                maxResults=max_results,
                singleEvents=True,
                orderBy="startTime",
            )
            .execute()
        )
        items = events_result.get("items", [])
    except Exception as e:
        raise ToolError(f"Failed to fetch calendar events: {e}")

    if not items:
        return {"result": f"No upcoming events found in the next {days_ahead} days.", "events": []}

    result = []
    for ev in items:
        start = ev["start"].get("dateTime", ev["start"].get("date", "Unknown"))
        end = ev["end"].get("dateTime", ev["end"].get("date", "Unknown"))
        entry = {
            "summary": ev.get("summary", "(No title)"),
            "start": start,
            "end": end,
            "htmlLink": ev.get("htmlLink", ""),
        }
        if show_all:
            entry["description"] = ev.get("description", "")
            entry["location"] = ev.get("location", "")
            entry["attendees"] = [
                {"email": a.get("email", ""), "responseStatus": a.get("responseStatus", "unknown")}
                for a in ev.get("attendees", [])
            ]
        result.append(entry)

    return {
        "result": f"Found {len(result)} event(s) in the next {days_ahead} days.",
        "events": result,
    }


@register("createCalendarEvent")
def create_calendar_event(args: Dict[str, Any]) -> Dict[str, Any]:
    """Create a Google Calendar event.

    Args:
        summary: Event title (required)
        description: Event description (optional)
        start_time: Start time in ISO format, e.g. '2026-07-24T14:00:00'
                   If only date like '2026-07-24', creates an all-day event
        end_time: End time in ISO format (required if start_time has time)
        location: Event location (optional)
        attendees: Comma-separated email addresses (optional)
    """
    summary = args.get("summary")
    if not summary:
        raise ToolError("'summary' (event title) is required.")

    start_time = args.get("start_time", "")
    end_time = args.get("end_time", "")
    description = args.get("description", "")
    location = args.get("location", "")

    if not start_time:
        start_time = datetime.utcnow().isoformat()
    if not end_time:
        end_time = (datetime.utcnow() + timedelta(hours=1)).isoformat()

    if "T" not in start_time:
        start_time += "T00:00:00"
        end_time = start_time[:10] + "T23:59:00"

    event = {
        "summary": summary,
        "start": {"dateTime": start_time, "timeZone": "UTC"},
        "end": {"dateTime": end_time, "timeZone": "UTC"},
    }
    if description:
        event["description"] = description
    if location:
        event["location"] = location

    attendees_raw = args.get("attendees", "")
    if attendees_raw:
        event["attendees"] = [{"email": e.strip()} for e in attendees_raw.split(",") if e.strip()]

    try:
        created = _calendar().events().insert(calendarId="primary", body=event).execute()
        return {
            "result": f"Event created: \"{summary}\"",
            "eventLink": created.get("htmlLink", ""),
            "id": created.get("id", ""),
        }
    except Exception as e:
        raise ToolError(f"Failed to create event: {e}")


# ---------------------------------------------------------------------------
# Gmail tools
# ---------------------------------------------------------------------------


@register("sendEmail")
def send_email(args: Dict[str, Any]) -> Dict[str, Any]:
    """Send an email via Gmail.

    Args:
        to: Recipient email address (required)
        subject: Email subject (required)
        body: Email body text (required)
        cc: CC email address (optional)
    """
    to = args.get("to")
    subject = args.get("subject")
    body = args.get("body")
    cc = args.get("cc", "")

    if not to or not subject or not body:
        raise ToolError("'to', 'subject', and 'body' are all required.")

    import base64
    from email.message import EmailMessage

    msg = EmailMessage()
    msg["To"] = to
    msg["Subject"] = subject
    msg["From"] = "me"
    if cc:
        msg["Cc"] = cc
    msg.set_content(body)

    try:
        raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
        _gmail().users().messages().send(userId="me", body={"raw": raw}).execute()
        return {"result": f"Email sent to {to}: \"{subject}\""}
    except Exception as e:
        raise ToolError(f"Failed to send email: {e}")


@register("getEmails")
def get_emails(args: Dict[str, Any]) -> Dict[str, Any]:
    """List recent emails from Gmail inbox.

    Args:
        max_results: Number of emails to return (default 5, max 20)
        query: Gmail search filter (optional), e.g. 'from:someone@email.com' or 'subject:meeting'
    """
    max_results = min(int(args.get("max_results", 5)), 20)
    query = args.get("query", "")

    try:
        result = _gmail().users().messages().list(userId="me", q=query, maxResults=max_results).execute()
        messages = result.get("messages", [])
    except Exception as e:
        raise ToolError(f"Failed to fetch emails: {e}")

    if not messages:
        return {"result": "No emails found matching your criteria.", "emails": []}

    emails = []
    for msg in messages:
        try:
            detail = _gmail().users().messages().get(userId="me", id=msg["id"], format="metadata", metadataHeaders=["From", "Subject", "Date"]).execute()
            headers = {h["name"]: h["value"] for h in detail.get("payload", {}).get("headers", [])}
            snippet = detail.get("snippet", "")
            emails.append({
                "id": msg["id"],
                "from": headers.get("From", "Unknown"),
                "subject": headers.get("Subject", "(No subject)"),
                "date": headers.get("Date", "Unknown"),
                "snippet": snippet,
            })
        except Exception:
            continue

    return {
        "result": f"Found {len(emails)} email(s).",
        "emails": emails,
    }


# ---------------------------------------------------------------------------
# Google Tasks tools
# ---------------------------------------------------------------------------


@register("getTasks")
def get_tasks(args: Dict[str, Any]) -> Dict[str, Any]:
    """List tasks from Google Tasks.

    Args:
        tasklist: Task list title (default 'My Tasks')
        max_results: Max tasks to return (default 10)
        show_completed: Include completed tasks (default false)
    """
    tasklist_title = args.get("tasklist", "My Tasks")
    max_results = min(int(args.get("max_results", 10)), 50)
    show_completed = bool(args.get("show_completed", False))

    try:
        lists = _tasks().tasklists().list().execute().get("items", [])
        tl = next((t for t in lists if t["title"].lower() == tasklist_title.lower()), None)
        if not tl:
            available = ", ".join(t["title"] for t in lists) if lists else "No task lists found"
            raise ToolError(f"Task list '{tasklist_title}' not found. Available: {available}")
        tl_id = tl["id"]

        tasks_result = _tasks().tasks().list(tasklist=tl_id, maxResults=max_results, showCompleted=show_completed).execute()
        items = tasks_result.get("items", [])
    except ToolError:
        raise
    except Exception as e:
        raise ToolError(f"Failed to fetch tasks: {e}")

    if not items:
        return {"result": f"No tasks in '{tasklist_title}'.", "tasks": []}

    result = []
    for t in items:
        result.append({
            "title": t.get("title", "(Untitled)"),
            "notes": t.get("notes", ""),
            "due": t.get("due", ""),
            "status": t.get("status", "needsAction"),
            "id": t.get("id", ""),
        })

    return {
        "result": f"Found {len(result)} task(s) in '{tasklist_title}'.",
        "tasks": result,
    }


@register("createTask")
def create_task(args: Dict[str, Any]) -> Dict[str, Any]:
    """Create a task in Google Tasks.

    Args:
        title: Task title (required)
        notes: Task notes/description (optional)
        due: Due date in ISO format, e.g. '2026-07-30' (optional)
        tasklist: Task list title (default 'My Tasks')
    """
    title = args.get("title")
    if not title:
        raise ToolError("'title' is required.")

    notes = args.get("notes", "")
    due = args.get("due", "")
    tasklist_title = args.get("tasklist", "My Tasks")

    body = {"title": title}
    if notes:
        body["notes"] = notes
    if due:
        body["due"] = due

    try:
        lists = _tasks().tasklists().list().execute().get("items", [])
        tl = next((t for t in lists if t["title"].lower() == tasklist_title.lower()), None)
        if not tl:
            available = ", ".join(t["title"] for t in lists) if lists else "No task lists found"
            raise ToolError(f"Task list '{tasklist_title}' not found. Available: {available}")

        created = _tasks().tasks().insert(tasklist=tl["id"], body=body).execute()
        return {
            "result": f"Task created: \"{title}\"",
            "id": created.get("id", ""),
        }
    except ToolError:
        raise
    except Exception as e:
        raise ToolError(f"Failed to create task: {e}")


__all__ = [
    "get_calendar_events",
    "create_calendar_event",
    "send_email",
    "get_emails",
    "get_tasks",
    "create_task",
]
