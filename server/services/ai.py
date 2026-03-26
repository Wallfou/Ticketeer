import os
import json
import google.generativeai as genai
import asyncio
from dotenv import load_dotenv

load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

PRIORITY_PATTERNS = {
    "README", "readme", "package.json", "requirements.txt",
    "pyproject.toml", "Dockerfile", "docker-compose",
    "main.py", "index.ts", "index.tsx", "App.tsx", "app.py",
    "models.py", "routes", "schema", "config"
}

MAX_CONTENT_CHARS = 320000

def is_priority_file(path: str) -> bool:
  filename = path.split("/")[-1].lower()
  return any(p.lower() in filename for p in PRIORITY_PATTERNS)

def build_context(repo_data: dict) -> str:
  file_tree = "\n".join(f["path"] for f in repo_data["files"])

  content_sections = []
  total_characters = 0

  priority_files = [f for f in repo_data["files"] if is_priority_file(f["path"])]
  rest_files = [f for f in repo_data["files"] if not is_priority_file(f["path"])]

  for file in priority_files + rest_files:
    content = file.get("content", "")
    if not content.strip():
      continue

    content_chunk = f"### {file['path']}\n```{file['language'].lower()}\n{content}\n```\n"
    if total_characters + len(content_chunk) > MAX_CONTENT_CHARS:
      break

    content_sections.append(content_chunk)
    total_characters += len(content_chunk)

  return f"""
  ## File Tree 
  {file_tree}

  ## File Contents
  {''.join(content_sections)}
  """.strip()

# step 1: analyze the repo and produce a detail overview of the codebase
async def analyze_repo(repo_data: dict) -> dict:
  context = build_context(repo_data)
  prompt = f"""
  You are a senior software engineer analyzing a codebase.

  Given the file tree and key file contents below, produce a structured analysis as valid JSON with these exact fields:
  - "summary": 2-3 sentence description of what the app does 
  - "frameworks": list of frameworks and major libraries detected
  - "languages": list of programming languages used
  - "modules": list of objects with "name" and "description" for each major module/area
  - "complexity_map": list of objects with "area", "level" (beginner/intermediate/advanced), and "reason"
  Return ONLY valid JSON, no markdown, no explanation.
  
  {context}
  """
  model = genai.GenerativeModel("gemini-2.5-flash")
  response = await model.generate_content_async(prompt)
  raw = response.text.strip()

  # strip markdown code block if gemini wraps the json
  if raw.startswith("```"):
    raw = raw.split("```")[1]
    if raw.startswith("json"):
      raw = raw[4:]

  return json.loads(raw.strip())

# step 2: analyze the user's goal and break it down into high level work streams
async def analyze_goal(goal: str, analysis: dict) -> dict:
  context = f"""
  Codebase Summary: {analysis['summary']}
  Frameworks: {', '.join(analysis['frameworks'])}
  Languages: {', '.join(analysis['languages'])}
  Modules:
  {chr(10).join(f"- {m['name']}: {m['description']}" for m in analysis['modules'])}
  Complexity:
  {chr(10).join(f"- {c['area']}: {c['level']}" for c in analysis['complexity_map'])}
  """
  prompt = f"""
  You are a senior engineering lead breaking down a feature request into scoped work.
  User's goal: "{goal}"
  {context}
  Break this goal into adequate number of epics (high-level work streams), then break each epic into 
  individual implementation tasks.
  Return ONLY valid JSON with this exact shape:
  {{
    "goal": "<the original goal>",
    "epics": [
      {{
        "name": "<epic name>",
        "description": "<what this epic covers>",
        "tasks": [
          {{
            "title": "<short task title>",
            "description": "<what needs to be done and why>",
            "file_hints": ["<relevant file paths from the codebase>"]
          }}
        ]
      }}
    ]
  }}
  Rules:
  - Epics should be distinct, non-overlapping work streams
  - Tasks should be concrete and implementable in isolation
  - file_hints should reference real files/folders from the codebase above
  """

  model = genai.GenerativeModel("gemini-2.5-flash")
  response = await model.generate_content_async(prompt)
  raw = response.text.strip()

  if raw.startswith("```"):
    raw = raw.split("```")[1]
    if raw.startswith("json"):
      raw = raw[4:]
  
  return json.loads(raw.strip())


# step 3.1: find relevant files
def retrieve_relevant_files(task: dict, repo_data: dict, max_chars: int = 12000) -> str:
    hints = set(h.lower() for h in task.get("file_hints", []))
    keywords = set(task["title"].lower().split()) | set(task["description"].lower().split()) | hints
    scored = []
    for file in repo_data["files"]:
        path_lower = file["path"].lower()
        score = sum(10 if hint in path_lower else 0 for hint in hints)
        score += sum(1 for kw in keywords if kw in path_lower)
        if score > 0:
            scored.append((score, file))
    scored.sort(key=lambda x: x[0], reverse=True)
    sections = []
    total = 0
    for _, file in scored:
        content = file.get("content", "")
        if not content.strip():
            continue
        chunk = f"### {file['path']}\n```{file['language'].lower()}\n{content}\n```\n"
        if total + len(chunk) > max_chars:
            break
        sections.append(chunk)
        total += len(chunk)
    return "\n".join(sections) if sections else "No directly relevant files found."


# step 3.2: classifying a task on the sclae of complexity and priority
async def classify_single_task(task: dict, repo_data: dict, analysis: dict) -> dict:
  relevant_files = retrieve_relevant_files(task, repo_data)
  prompt = f"""
  You are a senior engineering lead classifying a development task.
  Codebase context:
  - Summary: {analysis['summary']}
  - Frameworks: {', '.join(analysis['frameworks'])}
  - Languages: {', '.join(analysis['languages'])}
  Task:
  Title: {task['title']}
  Description: {task['description']}
  Most relevant files:
  {relevant_files}
  Classify this task and explain your reasoning with specific reference to the code above.
  Return ONLY valid JSON with this exact shape:
  {{
    "title": "{task['title']}",
    "description": "{task['description']}",
    "file_hints": {json.dumps(task.get('file_hints', []))},
    "complexity": "<beginner | intermediate | advanced>",
    "complexity_reason": "<why, referencing specific files or patterns seen in the code>",
    "priority": "<critical_path | important | nice_to_have>",
    "priority_reason": "<why this is or isn't blocking other work>"
  }}
  Complexity guide:
  - beginner: isolated change, no deep system knowledge needed, clear single file to edit
  - intermediate: requires understanding existing patterns, touches 2-3 files
  - advanced: modifies core infrastructure, high regression risk, requires understanding multiple systems
  Priority guide:
  - critical_path: other tasks cannot start or complete without this
  - important: significant value but not blocking
  - nice_to_have: improves UX/DX but can be deferred
  """
  model = genai.GenerativeModel("gemini-2.5-flash")
  response = await model.generate_content_async(prompt)
  raw = response.text.strip()
  if raw.startswith("```"):
      raw = raw.split("```")[1]
      if raw.startswith("json"):
          raw = raw[4:]
  return json.loads(raw.strip())

# step 3.3: classify all the tasks
async def classify_tasks(decomposition: dict, repo_data: dict, analysis: dict) -> dict:
  classified_epics = []
  for epic in decomposition["epics"]:
    # run all tasks in this epic concurrently
    classified_tasks = await asyncio.gather(*[
      classify_single_task(task, repo_data, analysis)
      for task in epic["tasks"]
    ])
    classified_epics.append({
      "name": epic["name"],
      "description": epic["description"],
      "tasks": list(classified_tasks)
    })
  return {
    "goal": decomposition["goal"],
    "epics": classified_epics
  }


# step 4.1: build a custom prompt for a single ticket based on complexity level
def _build_ticket_prompt(task: dict, epic_name: str, relevant_files: str, analysis: dict) -> str:
  complexity = task.get("complexity", "intermediate")
  title = task["title"]
  description = task["description"]
  file_hints = json.dumps(task.get("file_hints", []))
  complexity_reason = task.get("complexity_reason", "")
  priority = task.get("priority", "important")
  priority_reason = task.get("priority_reason", "")

  base_context = f"""
Codebase: {analysis['summary']}
Frameworks: {', '.join(analysis['frameworks'])}
Languages: {', '.join(analysis['languages'])}

Epic: {epic_name}
Task title: {title}
Task description: {description}
Complexity: {complexity} — {complexity_reason}
Priority: {priority} — {priority_reason}

Relevant files:
{relevant_files}
"""

  if complexity == "beginner":
    return f"""
You are a senior engineer writing a detailed ticket for a beginner contributor.

{base_context}

Generate a full ticket as valid JSON. This is a BEGINNER ticket — be thorough and hand-holding:
- Break the work into numbered step-by-step instructions
- Name the exact files to open and what to look for
- Explain any patterns or conventions they need to follow
- Include resource links (official docs, MDN, etc.) relevant to the task
- Keep language clear and avoid jargon

Return ONLY valid JSON with this exact shape:
{{
  "title": "{title}",
  "epic": "{epic_name}",
  "description": "<clear explanation of what this task does and why it matters>",
  "complexity": "beginner",
  "complexity_reason": "{complexity_reason}",
  "priority": "{priority}",
  "priority_reason": "{priority_reason}",
  "file_references": {file_hints},
  "steps": [
    "<step 1: specific instruction with file name>",
    "<step 2: ...>",
    "..."
  ],
  "acceptance_criteria": [
    "<what done looks like — testable and specific>",
    "..."
  ],
  "resources": [
    "<relevant doc or guide URL>",
    "..."
  ]
}}
"""

  elif complexity == "intermediate":
    return f"""
You are a senior engineer writing a ticket for an intermediate contributor.

{base_context}

Generate a full ticket as valid JSON. This is an INTERMEDIATE ticket — provide clear direction without over-explaining:
- Describe what to change and the key files involved
- Point out existing patterns in the codebase they should follow
- Include acceptance criteria

Return ONLY valid JSON with this exact shape:
{{
  "title": "{title}",
  "epic": "{epic_name}",
  "description": "<clear explanation of what this task does and why it matters>",
  "complexity": "intermediate",
  "complexity_reason": "{complexity_reason}",
  "priority": "{priority}",
  "priority_reason": "{priority_reason}",
  "file_references": {file_hints},
  "steps": [
    "<high-level step referencing key files and patterns>",
    "..."
  ],
  "acceptance_criteria": [
    "<what done looks like — testable and specific>",
    "..."
  ],
  "resources": []
}}
"""

  else:  # advanced
    return f"""
You are a senior engineer writing a ticket for an advanced contributor.

{base_context}

Generate a full ticket as valid JSON. This is an ADVANCED ticket — be concise and assume full familiarity with the stack:
- Focus on the what and why, not the how
- Call out risks, edge cases, and constraints
- Keep steps high-level and non-prescriptive

Return ONLY valid JSON with this exact shape:
{{
  "title": "{title}",
  "epic": "{epic_name}",
  "description": "<technical description focused on constraints and impact>",
  "complexity": "advanced",
  "complexity_reason": "{complexity_reason}",
  "priority": "{priority}",
  "priority_reason": "{priority_reason}",
  "file_references": {file_hints},
  "steps": [
    "<high-level concern or constraint to address>",
    "..."
  ],
  "acceptance_criteria": [
    "<what done looks like — testable and specific>",
    "..."
  ],
  "resources": []
}}
"""


# step 4.2: write a full ticket for a single classified task
async def write_single_ticket(task: dict, epic_name: str, repo_data: dict, analysis: dict) -> dict:
  relevant_files = retrieve_relevant_files(task, repo_data)
  prompt = _build_ticket_prompt(task, epic_name, relevant_files, analysis)

  model = genai.GenerativeModel("gemini-2.5-flash")
  response = await model.generate_content_async(prompt)
  raw = response.text.strip()

  if raw.startswith("```"):
    raw = raw.split("```")[1]
    if raw.startswith("json"):
      raw = raw[4:]

  return json.loads(raw.strip())


# step 4.3: write all tickets across all epics
async def write_tickets(classified: dict, repo_data: dict, analysis: dict) -> dict:
  result_epics = []

  for epic in classified["epics"]:
    tickets = await asyncio.gather(*[
      write_single_ticket(task, epic["name"], repo_data, analysis)
      for task in epic["tasks"]
    ])
    result_epics.append({
      "name": epic["name"],
      "description": epic["description"],
      "tickets": list(tickets)
    })

  return {
    "goal": classified["goal"],
    "epics": result_epics
  }

