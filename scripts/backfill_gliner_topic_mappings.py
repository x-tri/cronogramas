#!/usr/bin/env python3
"""Backfill dos mapeamentos GLiNER para content_topics e exam_question_topics.

Fluxo:
1. Lê exams/projetos do banco de simulados.
2. Procura question_contents com metadados gliner.
3. Cria tópicos canônicos faltantes no banco principal.
4. Faz upsert em exam_question_topics por (exam_id, question_number).
"""

from __future__ import annotations

import argparse
import json
import os
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

TITLE_FIELD_BY_TABLE = {
    "exams": "title",
    "projetos": "nome",
}

AREA_SIGLA_MAP = {
    "Linguagens": "LC",
    "Ciências Humanas": "CH",
    "Ciências da Natureza": "CN",
    "Matemática": "MT",
    "Redação": "RED",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Backfill GLiNER -> content_topics/exam_question_topics.",
    )
    parser.add_argument("--table", choices=("exams", "projetos"), default="exams")
    parser.add_argument("--record-id", help="ID específico do registro no banco de simulados.")
    parser.add_argument(
        "--limit",
        type=int,
        default=20,
        help="Quantidade máxima de registros buscados quando --record-id não for usado.",
    )
    parser.add_argument(
        "--env-file",
        default=".env.local",
        help="Arquivo de ambiente com as credenciais de ambos os bancos.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Persiste content_topics e exam_question_topics no banco principal.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Só imprime resumo; não escreve no banco principal.",
    )
    return parser.parse_args()


def load_env_file(env_file: str) -> None:
    path = Path(env_file)
    if not path.exists():
        return

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


def require_env(name: str, fallback: str | None = None) -> str:
    value = os.getenv(name) or (os.getenv(fallback) if fallback else None)
    if not value:
        raise SystemExit(f"Variável obrigatória ausente: {name}")
    return value


def supabase_request(
    base_url: str,
    api_key: str,
    path: str,
    *,
    method: str = "GET",
    payload: Any | None = None,
    prefer: str | None = None,
) -> Any:
    url = f"{base_url.rstrip('/')}/rest/v1/{path.lstrip('/')}"
    request = urllib.request.Request(url, method=method)
    request.add_header("apikey", api_key)
    request.add_header("Authorization", f"Bearer {api_key}")
    request.add_header("Content-Type", "application/json")
    if prefer:
      request.add_header("Prefer", prefer)
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
        request.data = body

    try:
        with urllib.request.urlopen(request) as response:
            content = response.read().decode("utf-8")
            if not content:
                return None
            return json.loads(content)
    except urllib.error.HTTPError as exc:
        details = exc.read().decode("utf-8", errors="ignore")
        raise SystemExit(
            f"Erro HTTP {exc.code} em {method} {url}: {details or exc.reason}",
        ) from exc


def fetch_simulado_records(
    table: str,
    record_id: str | None,
    limit: int,
    *,
    base_url: str,
    api_key: str,
) -> list[dict[str, Any]]:
    params = {
        "select": f"id,{TITLE_FIELD_BY_TABLE[table]},question_contents",
        "order": "id.asc",
    }
    if record_id:
        params["id"] = f"eq.{record_id}"
    else:
        params["limit"] = str(limit)

    query = urllib.parse.urlencode(params)
    payload = supabase_request(base_url, api_key, f"{table}?{query}")
    return payload if isinstance(payload, list) else []


def fetch_existing_topics(*, base_url: str, api_key: str) -> dict[str, dict[str, Any]]:
    payload = supabase_request(
        base_url,
        api_key,
        "content_topics?select=id,canonical_label,area_sigla,subject_label,topic_label",
    )
    rows = payload if isinstance(payload, list) else []
    return {
        str(row["canonical_label"]).strip().lower(): row
        for row in rows
        if row.get("canonical_label")
    }


def normalize_string(value: Any) -> str | None:
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


def resolve_topic_parts(question: dict[str, Any]) -> dict[str, Any] | None:
    gliner = question.get("gliner")
    if not isinstance(gliner, dict):
        return None

    review_status = normalize_string(gliner.get("reviewStatus")) or "pending"
    if review_status not in {"pending", "approved", "rejected"}:
        review_status = "pending"

    label = normalize_string(gliner.get("approvedLabel")) or normalize_string(
        gliner.get("suggestedLabel"),
    )
    subject = normalize_string(gliner.get("suggestedSubject"))
    topic = normalize_string(gliner.get("suggestedTopic"))

    if label and " - " in label:
        parsed_subject, parsed_topic = [part.strip() for part in label.split(" - ", 1)]
        subject = subject or parsed_subject
        topic = topic or parsed_topic

    if not label and subject and topic:
        label = f"{subject} - {topic}"

    area_sigla = AREA_SIGLA_MAP.get(normalize_string(gliner.get("suggestedArea")) or "")
    if not label or not subject or not topic or not area_sigla:
        return None

    confidence = gliner.get("suggestedTopicConfidence")
    if confidence is None:
        confidence = gliner.get("suggestedSubjectConfidence")

    return {
        "area_sigla": area_sigla,
        "subject_label": subject,
        "topic_label": topic,
        "canonical_label": label,
        "review_status": review_status,
        "confidence": confidence,
        "reviewed_at": gliner.get("classifiedAt") if review_status == "approved" else None,
    }


def resolve_question_number(question: dict[str, Any], fallback_index: int) -> int:
    for field_name in ("questionNumber", "numero", "questao"):
        value = question.get(field_name)
        if isinstance(value, int):
            return value
        if isinstance(value, str) and value.strip().isdigit():
            return int(value.strip())
    return fallback_index + 1


def ensure_topics(
    topic_payloads: list[dict[str, Any]],
    *,
    base_url: str,
    api_key: str,
    apply_changes: bool,
) -> dict[str, dict[str, Any]]:
    existing_topics = fetch_existing_topics(base_url=base_url, api_key=api_key)
    missing_topics = []

    for payload in topic_payloads:
      key = payload["canonical_label"].lower()
      if key not in existing_topics:
          missing_topics.append(payload)

    if missing_topics and apply_changes:
        supabase_request(
            base_url,
            api_key,
            "content_topics",
            method="POST",
            payload=missing_topics,
            prefer="resolution=merge-duplicates,return=representation",
        )
        existing_topics = fetch_existing_topics(base_url=base_url, api_key=api_key)

    return existing_topics


def main() -> None:
    args = parse_args()
    load_env_file(args.env_file)

    simulado_base_url = require_env("VITE_SIMULADO_SUPABASE_URL")
    simulado_api_key = os.getenv("SIMULADO_SUPABASE_SERVICE_ROLE_KEY") or require_env(
        "VITE_SIMULADO_SUPABASE_KEY",
    )
    primary_base_url = require_env("VITE_SUPABASE_URL")
    primary_api_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or require_env(
        "VITE_SUPABASE_KEY",
    )

    apply_changes = args.apply and not args.dry_run
    records = fetch_simulado_records(
        args.table,
        args.record_id,
        args.limit,
        base_url=simulado_base_url,
        api_key=simulado_api_key,
    )

    if not records:
        print("Nenhum registro com question_contents GLiNER encontrado.")
        return

    topic_payloads: list[dict[str, Any]] = []
    mapping_payloads: list[dict[str, Any]] = []
    inspected_questions = 0

    for record in records:
        question_contents = record.get("question_contents") or []
        if not isinstance(question_contents, list):
            continue

        for index, question in enumerate(question_contents):
            if not isinstance(question, dict):
                continue

            inspected_questions += 1
            topic_parts = resolve_topic_parts(question)
            if not topic_parts:
                continue

            topic_payloads.append({
                "area_sigla": topic_parts["area_sigla"],
                "subject_label": topic_parts["subject_label"],
                "topic_label": topic_parts["topic_label"],
                "canonical_label": topic_parts["canonical_label"],
            })
            mapping_payloads.append({
                "exam_id": record["id"],
                "question_number": resolve_question_number(question, index),
                "canonical_label": topic_parts["canonical_label"],
                "mapping_source": "gliner_approved",
                "review_status": topic_parts["review_status"],
                "confidence": topic_parts["confidence"],
                "reviewed_at": topic_parts["reviewed_at"],
            })

    if not mapping_payloads:
        print("Nenhum question_content com GLiNER elegível para backfill.")
        return

    topics_by_label = ensure_topics(
        topic_payloads,
        base_url=primary_base_url,
        api_key=primary_api_key,
        apply_changes=apply_changes,
    )

    upsert_rows = []
    for payload in mapping_payloads:
        topic_row = topics_by_label.get(payload["canonical_label"].lower())
        if not topic_row:
            continue

        upsert_rows.append({
            "exam_id": payload["exam_id"],
            "question_number": payload["question_number"],
            "topic_id": topic_row["id"],
            "mapping_source": payload["mapping_source"],
            "review_status": payload["review_status"],
            "confidence": payload["confidence"],
            "reviewed_at": payload["reviewed_at"],
        })

    if apply_changes:
        supabase_request(
            primary_base_url,
            primary_api_key,
            "exam_question_topics?on_conflict=exam_id,question_number",
            method="POST",
            payload=upsert_rows,
            prefer="resolution=merge-duplicates,return=minimal",
        )

    preview = upsert_rows[:5]
    print(
        json.dumps(
            {
                "table": args.table,
                "records_scanned": len(records),
                "questions_scanned": inspected_questions,
                "topics_resolved": len({row["topic_id"] for row in upsert_rows}),
                "mappings_prepared": len(upsert_rows),
                "apply": apply_changes,
                "preview": preview,
            },
            indent=2,
            ensure_ascii=False,
        ),
    )


if __name__ == "__main__":
    main()
