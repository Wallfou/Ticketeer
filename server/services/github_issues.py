"""
Create GitHub Issues from Ticketeer tickets: labels, assignees, dependency links.
"""
from __future__ import annotations

import os
from typing import Any, Optional

import httpx

from services.github import BASE_URL, GITHUB_TOKEN, parse_github_url

PRIORITY_RANK = {"critical_path": 0, "important": 1, "nice_to_have": 2}
COMPLEXITY_RANK = {"beginner": 0, "intermediate": 1, "advanced": 2}

PRIORITY_LABEL = {
    "critical_path": "critical",
    "important": "important",
    "nice_to_have": "nice-to-have",
}

LABEL_DEFS = [
    ("complexity: beginner", "238636"),
    ("complexity: intermediate", "d29922"),
    ("complexity: advanced", "b62324"),
    ("priority: critical", "d73a4a"),
    ("priority: important", "fb8500"),
    ("priority: nice-to-have", "6e7681"),
]


def _headers(token: Optional[str]) -> dict[str, str]:
    h = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h


def _ticket_labels(ticket: dict[str, Any]) -> list[str]:
    c = ticket.get("complexity") or "intermediate"
    if c not in ("beginner", "intermediate", "advanced"):
        c = "intermediate"
    p = ticket.get("priority") or "important"
    pl = PRIORITY_LABEL.get(p, "important")
    return [f"complexity: {c}", f"priority: {pl}"]


def _build_base_body(ticket: dict[str, Any]) -> str:
    parts: list[str] = []
    epic = ticket.get("epic")
    if epic:
        parts.append(f"**Epic:** {epic}\n")
    parts.append((ticket.get("description") or "").strip())
    steps = ticket.get("steps") or []
    if steps:
        parts.append("\n## Steps\n" + "\n".join(f"{i + 1}. {s}" for i, s in enumerate(steps)))
    ac = ticket.get("acceptance_criteria") or []
    if ac:
        parts.append("\n## Acceptance criteria\n" + "\n".join(f"- {c}" for c in ac))
    files = ticket.get("file_references") or []
    if files:
        parts.append("\n## Files\n" + "\n".join(f"- `{f}`" for f in files))
    resources = ticket.get("resources") or []
    if resources:
        parts.append("\n## Resources\n" + "\n".join(f"- {r}" for r in resources))
    return "\n".join(parts).strip()


def _sort_key(ticket: dict[str, Any]):
    pr = PRIORITY_RANK.get(ticket.get("priority"), 99)
    cr = COMPLEXITY_RANK.get(ticket.get("complexity"), 99)
    return (pr, cr, (ticket.get("title") or "").lower())


def _epic_chains(tickets: list[dict[str, Any]]) -> dict[str, list[str]]:
    by_epic: dict[str, list[dict[str, Any]]] = {}
    for t in tickets:
        epic = (t.get("epic") or "General").strip() or "General"
        by_epic.setdefault(epic, []).append(t)
    chains: dict[str, list[str]] = {}
    for epic, ts in by_epic.items():
        ts = sorted(ts, key=_sort_key)
        chains[epic] = [t["id"] for t in ts]
    return chains


def _prerequisite_ids(
    ticket: dict[str, Any],
    chains: dict[str, list[str]],
    id_set: set[str],
) -> list[str]:
    explicit = [x for x in (ticket.get("depends_on_ticket_ids") or []) if x in id_set]
    if explicit:
        return explicit
    epic = (ticket.get("epic") or "General").strip() or "General"
    chain = chains.get(epic, [])
    try:
        i = chain.index(ticket["id"])
    except ValueError:
        return []
    if i <= 0:
        return []
    return [chain[i - 1]]


def _dependency_markdown(
    ticket_id: str,
    tickets_by_id: dict[str, dict[str, Any]],
    prereq_map: dict[str, list[str]],
    issue_num_by_id: dict[str, int],
) -> str:
    lines: list[str] = []
    for pid in prereq_map.get(ticket_id, []):
        num = issue_num_by_id.get(pid)
        if not num:
            continue
        pt = tickets_by_id.get(pid) or {}
        title = (pt.get("title") or "Ticket").strip()
        lines.append(f"- **Prerequisite:** #{num} — _{title}_")

    downstream = [
        tid
        for tid, pres in prereq_map.items()
        if ticket_id in pres and tid in issue_num_by_id
    ]
    for tid in downstream:
        num = issue_num_by_id[tid]
        tt = tickets_by_id.get(tid) or {}
        title = (tt.get("title") or "Ticket").strip()
        lines.append(f"- **Unblocks:** #{num} — _{title}_")

    if not lines:
        return ""
    return "\n".join(lines)


async def _ensure_labels(
    client: httpx.AsyncClient,
    owner: str,
    repo: str,
    headers: dict[str, str],
) -> None:
    for name, color in LABEL_DEFS:
        url = f"{BASE_URL}/repos/{owner}/{repo}/labels"
        r = await client.post(url, headers=headers, json={"name": name, "color": color})
        if r.status_code == 422:
            continue
        r.raise_for_status()


async def _create_issue(
    client: httpx.AsyncClient,
    owner: str,
    repo: str,
    headers: dict[str, str],
    title: str,
    body: str,
    labels: list[str],
    assignees: list[str],
) -> dict[str, Any]:
    url = f"{BASE_URL}/repos/{owner}/{repo}/issues"
    payload: dict[str, Any] = {
        "title": title[:256],
        "body": body,
        "labels": labels,
    }
    if assignees:
        payload["assignees"] = assignees
    r = await client.post(url, headers=headers, json=payload)
    if r.status_code == 422 and assignees:
        payload.pop("assignees", None)
        r = await client.post(url, headers=headers, json=payload)
    r.raise_for_status()
    return r.json()


async def _patch_issue_body(
    client: httpx.AsyncClient,
    owner: str,
    repo: str,
    headers: dict[str, str],
    issue_number: int,
    body: str,
) -> None:
    url = f"{BASE_URL}/repos/{owner}/{repo}/issues/{issue_number}"
    r = await client.patch(url, headers=headers, json={"body": body})
    r.raise_for_status()


def _assignees_for_ticket(ticket: dict[str, Any], team: list[dict[str, Any]]) -> list[str]:
    mid = ticket.get("assignee_member_id")
    if not mid:
        return []
    for m in team:
        if m.get("id") == mid:
            gh = (m.get("github_username") or "").strip().lstrip("@")
            return [gh] if gh else []
    return []


async def export_tickets_to_github_issues(
    repo_url: str,
    tickets: list[dict[str, Any]],
    team: list[dict[str, Any]],
    token: Optional[str] = None,
) -> dict[str, Any]:
    """
    Creates one issue per ticket, applies labels, assignees,
    then updates bodies with prereqs / unblocks links to other issue numbers.
    """
    token = token or GITHUB_TOKEN
    if not token:
        raise ValueError("GitHub token required (set GITHUB_TOKEN or pass Authorization header)")

    if not tickets:
        raise ValueError("No tickets to export")

    owner, repo = parse_github_url(repo_url)
    headers = _headers(token)
    tickets_by_id = {t["id"]: t for t in tickets if t.get("id")}
    id_set = set(tickets_by_id.keys())
    chains = _epic_chains(list(tickets_by_id.values()))

    prereq_map: dict[str, list[str]] = {}
    for t in tickets_by_id.values():
        prereq_map[t["id"]] = _prerequisite_ids(t, chains, id_set)

    issue_urls: list[str] = []
    issue_num_by_id: dict[str, int] = {}
    warnings: list[str] = []

    async with httpx.AsyncClient(timeout=120.0) as client:
        await _ensure_labels(client, owner, repo, headers)

        for t in tickets:
            tid = t.get("id")
            if not tid:
                continue
            base = _build_base_body(t)
            labels = _ticket_labels(t)
            assignees = _assignees_for_ticket(t, team)

            try:
                created = await _create_issue(
                    client,
                    owner,
                    repo,
                    headers,
                    (t.get("title") or "Untitled")[:256],
                    base,
                    labels,
                    assignees,
                )
            except httpx.HTTPStatusError as e:
                warnings.append(f"Failed to create issue for '{t.get('title', tid)}': {e}")
                continue

            num = int(created["number"])
            html_url = created.get("html_url", "")
            if html_url:
                issue_urls.append(html_url)
            issue_num_by_id[tid] = num

        for t in tickets:
            tid = t.get("id")
            if not tid or tid not in issue_num_by_id:
                continue
            dm = _dependency_markdown(tid, tickets_by_id, prereq_map, issue_num_by_id)
            base = _build_base_body(t)
            footer = "\n\n---\n*Exported from Ticketeer*\n"
            if dm:
                body = base + "\n\n---\n### Dependencies\n" + dm + footer
            else:
                body = base + footer
            try:
                await _patch_issue_body(
                    client,
                    owner,
                    repo,
                    headers,
                    issue_num_by_id[tid],
                    body,
                )
            except httpx.HTTPStatusError as e:
                warnings.append(f"Failed to update issue #{issue_num_by_id[tid]}: {e}")

    return {
        "repo": f"{owner}/{repo}",
        "created": len(issue_urls),
        "issue_urls": issue_urls,
        "warnings": warnings,
    }
