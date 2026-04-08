#!/usr/bin/env python3
"""Seed persistente de homologação para a taxonomia do mentor.

Fluxo:
1. Lê um projeto real no banco de simulados.
2. Reproduz a regra atual do app para calcular questões erradas.
3. Usa apenas labels reais vindos de question_contents.content/conteudo.
4. Opcionalmente aplica ou limpa o seed via RPC transacional no backend do mentor.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

DEFAULT_STUDENT_MATRICULA = "101051"
DEFAULT_PROJECT_ID = "6523aa55-175b-4832-a62c-054c50ba5167"
DEFAULT_SEED_REFERENCE = (
    "seed:101051:6523aa55-175b-4832-a62c-054c50ba5167"
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Seed persistente de homologação para content_topics/exam_question_topics.",
    )
    parser.add_argument(
        "--student-matricula",
        default=DEFAULT_STUDENT_MATRICULA,
        help="Matrícula real do aluno usada como base para o seed.",
    )
    parser.add_argument(
        "--project-id",
        default=DEFAULT_PROJECT_ID,
        help="ID do projeto na tabela projetos que será usado como exam_id real.",
    )
    parser.add_argument(
        "--seed-reference",
        default=DEFAULT_SEED_REFERENCE,
        help="Referência rastreável do seed de homologação.",
    )
    parser.add_argument(
        "--env-file",
        default=".env.local",
        help="Arquivo de ambiente local com as credenciais dos bancos.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Só imprime o dataset calculado; não escreve no backend do mentor.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Aplica o seed via RPC transacional.",
    )
    parser.add_argument(
        "--cleanup",
        action="store_true",
        help="Arquiva o seed homologado via RPC transacional.",
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
    url = f"{base_url.rstrip('/')}/{path.lstrip('/')}"
    request = urllib.request.Request(url, method=method)
    request.add_header("apikey", api_key)
    request.add_header("Authorization", f"Bearer {api_key}")
    request.add_header("Content-Type", "application/json")
    if prefer:
        request.add_header("Prefer", prefer)
    if payload is not None:
        request.data = json.dumps(payload).encode("utf-8")

    try:
        with urllib.request.urlopen(request) as response:
            body = response.read().decode("utf-8")
            if not body:
                return None
            return json.loads(body)
    except urllib.error.HTTPError as exc:
        details = exc.read().decode("utf-8", errors="ignore")
        raise SystemExit(
            f"Erro HTTP {exc.code} em {method} {url}: {details or exc.reason}",
        ) from exc


def fetch_project(
    *,
    base_url: str,
    api_key: str,
    project_id: str,
) -> dict[str, Any]:
    params = urllib.parse.urlencode(
        {
            "select": "id,nome,answer_key,question_contents,students,created_at",
            "id": f"eq.{project_id}",
        },
    )
    payload = supabase_request(
        base_url,
        api_key,
        f"rest/v1/projetos?{params}",
    )
    rows = payload if isinstance(payload, list) else []
    if not rows:
        raise SystemExit(f"Projeto não encontrado: {project_id}")
    return rows[0]


def normalize_matricula(value: str) -> str:
    normalized = value.strip()
    return re.sub(r"^0+", "", normalized) or "0"


def extract_student_number(student: dict[str, Any]) -> str | None:
    raw_id = student.get("id")
    if isinstance(raw_id, str):
        match = re.search(r"merged-(\d+)-\d+$", raw_id)
        if match:
            return match.group(1)

    for key in ("studentNumber", "student_number", "matricula"):
        value = student.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()

    return None


def is_matching_student(student: dict[str, Any], matricula: str) -> bool:
    target = matricula.strip()
    normalized_target = normalize_matricula(target)
    candidates = []
    for key in ("matricula", "student_number", "studentNumber"):
        value = student.get(key)
        if value is not None:
            candidates.append(str(value).strip())

    extracted = extract_student_number(student)
    if extracted:
        candidates.append(extracted)

    for candidate in candidates:
        if candidate == target or normalize_matricula(candidate) == normalized_target:
            return True

    return False


def resolve_question_number(question: dict[str, Any], fallback_index: int) -> int:
    for key in ("questionNumber", "numero", "questao"):
        value = question.get(key)
        if isinstance(value, int):
            return value
        if isinstance(value, str) and value.strip().isdigit():
            return int(value.strip())
    return fallback_index + 1


def extract_label(question: dict[str, Any]) -> str | None:
    for key in ("content", "conteudo"):
        value = question.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def split_label(label: str) -> tuple[str, str]:
    if " - " in label:
        subject_label, topic_label = [part.strip() for part in label.split(" - ", 1)]
        return subject_label or label, topic_label or label
    return label, label


def resolve_area_sigla(question_number: int) -> str:
    if 1 <= question_number <= 45:
        return "LC"
    if 46 <= question_number <= 90:
        return "CH"
    if 91 <= question_number <= 135:
        return "CN"
    return "MT"


def build_seed_dataset(
    *,
    student_matricula: str,
    project: dict[str, Any],
) -> dict[str, Any]:
    question_contents = project.get("question_contents") or []
    answer_key = project.get("answer_key") or []
    students = project.get("students") or []

    student = next(
        (entry for entry in students if is_matching_student(entry, student_matricula)),
        None,
    )
    if student is None:
        raise SystemExit(
            f"Aluno {student_matricula} não encontrado no projeto {project['id']}.",
        )

    student_answers = student.get("answers") or []
    if not isinstance(student_answers, list) or not student_answers:
        raise SystemExit(
            f"Aluno {student_matricula} não possui respostas válidas no projeto.",
        )

    mappings: list[dict[str, Any]] = []
    wrong_questions_total = 0

    for index in range(min(len(student_answers), len(answer_key))):
        student_answer = student_answers[index]
        correct_answer = answer_key[index]
        question_number = index + 1

        if student_answer and student_answer != correct_answer:
            wrong_questions_total += 1
            question = next(
                (
                    item
                    for item in question_contents
                    if resolve_question_number(item, index) == question_number
                ),
                None,
            )
            if not isinstance(question, dict):
                continue

            label = extract_label(question)
            if not label:
                continue

            subject_label, topic_label = split_label(label)
            mappings.append(
                {
                    "exam_id": project["id"],
                    "question_number": question_number,
                    "canonical_label": label,
                    "subject_label": subject_label,
                    "topic_label": topic_label,
                    "area_sigla": resolve_area_sigla(question_number),
                },
            )

    unique_labels = sorted(
        {mapping["canonical_label"] for mapping in mappings if mapping["canonical_label"]},
    )
    coverage_expected = (
        round((len(mappings) / wrong_questions_total) * 100, 2)
        if wrong_questions_total > 0
        else 0.0
    )

    return {
        "project_id": project["id"],
        "project_name": project.get("nome"),
        "student_matricula": student_matricula,
        "records_scanned": 1,
        "wrong_questions_total": wrong_questions_total,
        "wrong_questions_with_label": len(mappings),
        "unique_labels": len(unique_labels),
        "coverage_expected": coverage_expected,
        "unique_label_values": unique_labels,
        "mappings": mappings,
        "preview": mappings[:10],
    }


def call_rpc(
    *,
    base_url: str,
    api_key: str,
    function_name: str,
    payload: dict[str, Any],
) -> Any:
    return supabase_request(
        base_url,
        api_key,
        f"rest/v1/rpc/{function_name}",
        method="POST",
        payload=payload,
    )


def main() -> None:
    args = parse_args()
    load_env_file(args.env_file)

    if sum(bool(flag) for flag in (args.dry_run, args.apply, args.cleanup)) > 1:
        raise SystemExit("Use apenas um modo por execução: --dry-run, --apply ou --cleanup.")

    if not args.dry_run and not args.apply and not args.cleanup:
        args.dry_run = True

    simulado_base_url = require_env("VITE_SIMULADO_SUPABASE_URL")
    simulado_api_key = os.getenv("SIMULADO_SUPABASE_SERVICE_ROLE_KEY") or require_env(
        "VITE_SIMULADO_SUPABASE_KEY",
    )
    primary_base_url = require_env("VITE_SUPABASE_URL")

    if args.apply or args.cleanup:
        primary_api_key = require_env("SUPABASE_SERVICE_ROLE_KEY")
    else:
        primary_api_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or require_env(
            "VITE_SUPABASE_KEY",
        )

    if args.cleanup:
        result = call_rpc(
            base_url=primary_base_url,
            api_key=primary_api_key,
            function_name="cleanup_homologation_taxonomy_seed",
            payload={"seed_reference": args.seed_reference},
        )
        archived = result[0] if isinstance(result, list) and result else result
        print(
            json.dumps(
                {
                    "seed_reference": args.seed_reference,
                    "archived_mappings": archived.get("archived_mappings", 0)
                    if isinstance(archived, dict)
                    else 0,
                    "archived_topics": archived.get("archived_topics", 0)
                    if isinstance(archived, dict)
                    else 0,
                },
                ensure_ascii=False,
                indent=2,
            ),
        )
        return

    project = fetch_project(
        base_url=simulado_base_url,
        api_key=simulado_api_key,
        project_id=args.project_id,
    )
    dataset = build_seed_dataset(
        student_matricula=args.student_matricula,
        project=project,
    )

    output = {
        "seed_reference": args.seed_reference,
        **{key: value for key, value in dataset.items() if key != "mappings"},
    }

    if args.dry_run:
        print(json.dumps(output, ensure_ascii=False, indent=2))
        return

    result = call_rpc(
        base_url=primary_base_url,
        api_key=primary_api_key,
        function_name="apply_homologation_taxonomy_seed",
        payload={
            "seed_reference": args.seed_reference,
            "mappings": dataset["mappings"],
        },
    )
    applied = result[0] if isinstance(result, list) and result else result

    print(
        json.dumps(
            {
                **output,
                "rpc_result": applied,
            },
            ensure_ascii=False,
            indent=2,
        ),
    )


if __name__ == "__main__":
    main()
