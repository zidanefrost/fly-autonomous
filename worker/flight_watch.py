"""Supabase access for the flight_watches table — persistent per-flight
WhatsApp tracking subscriptions, checked each refresh cycle alongside the
102-airport monitoring loop.
"""

from __future__ import annotations

from supabase import Client


def create_watch(
    client: Client,
    phone: str,
    departure_icao: str,
    arrival_icao: str | None,
    departure_time_iso: str,
) -> dict:
    resp = (
        client.table("flight_watches")
        .insert(
            {
                "phone": phone,
                "departure_icao": departure_icao,
                "arrival_icao": arrival_icao,
                "departure_time": departure_time_iso,
            }
        )
        .execute()
    )
    return resp.data[0]


def set_conversation(client: Client, watch_id: str, conversation_id: str, level: str) -> None:
    client.table("flight_watches").update(
        {"wassist_conversation_id": conversation_id, "last_notified_level": level}
    ).eq("id", watch_id).execute()


def get_active_watches(client: Client) -> list[dict]:
    resp = client.table("flight_watches").select("*").eq("active", True).execute()
    return resp.data


def update_notified_level(client: Client, watch_id: str, level: str) -> None:
    client.table("flight_watches").update({"last_notified_level": level}).eq("id", watch_id).execute()


def deactivate(client: Client, watch_id: str) -> None:
    client.table("flight_watches").update({"active": False}).eq("id", watch_id).execute()
