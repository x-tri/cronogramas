#!/usr/bin/env python3
"""Enriquece question_contents com metadados canônicos gerados pelo GLiNER2.

Uso típico:
  python3 scripts/gliner_enrich_question_contents.py \
    --table exams \
    --record-id 4f791b0e-0605-41d0-bc4e-127d9db17e9e \
    --dry-run

Por padrão o script só lê e imprime um resumo. Use --apply para enviar o
question_contents enriquecido de volta ao Supabase.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

AREA_LABELS = [
    "Linguagens",
    "Ciências Humanas",
    "Matemática",
    "Ciências da Natureza",
]

SUBJECT_LABELS = {
    "Linguagens": [
        "Português",
        "Arte",
        "Inglês",
        "Espanhol",
        "Redação",
    ],
    "Ciências Humanas": [
        "História",
        "Geografia",
        "Filosofia",
        "Sociologia",
    ],
    "Matemática": [
        "Matemática",
    ],
    "Ciências da Natureza": [
        "Física",
        "Química",
        "Biologia",
    ],
}

TOPIC_LABELS = {
    "Português": [
        "Interpretação de textos",
        "Literatura",
        "Gramática",
        "Estilística",
        "Variações linguísticas",
        "Teoria da comunicação",
    ],
    "Arte": [
        "Expressões da arte",
        "História da arte",
        "Arte contemporânea",
        "Matrizes culturais",
        "Arte do Brasil",
    ],
    "Inglês": [
        "Text comprehension",
    ],
    "Espanhol": [
        "Interpretación de textos",
        "Vocabulario",
        "Gramática",
    ],
    "Redação": [
        "Treino de redação",
    ],
    "História": [
        "Brasil",
        "Geral",
        "Temática",
        "América",
    ],
    "Geografia": [
        "Econômica",
        "Física",
        "Geopolítica",
        "Humana",
        "Questões ambientais",
        "Regional",
    ],
    "Filosofia": [
        "Filosofia política",
        "Ética",
        "Teoria do conhecimento",
        "Filosofia moderna",
        "Filosofia antiga",
        "Filosofia contemporânea",
        "Filosofia medieval",
    ],
    "Sociologia": [
        "Diversidade cultural e estratificação social",
        "Poder, Estado e política",
        "Teoria sociológica",
        "Trabalho e produção",
        "Movimentos sociais",
    ],
    "Matemática": [
        "Grandezas proporcionais",
        "Geometria espacial",
        "Funções",
        "Geometria plana",
        "Estatística",
        "Probabilidades",
        "Aritmética",
        "Análise combinatória",
        "Médias",
        "Trigonometria",
        "Geometria analítica",
        "Progressão aritmética",
        "Inequações",
        "Logaritmos",
    ],
    "Física": [
        "Mecânica",
        "Eletricidade",
        "Ondulatória",
        "Termologia",
        "Óptica",
        "Magnetismo",
    ],
    "Química": [
        "Físico-química",
        "Química Geral",
        "Orgânica",
        "Atomística",
        "Meio ambiente",
        "Bioquímica",
    ],
    "Biologia": [
        "Ecologia",
        "Fisiologia animal e humana",
        "Genética",
        "Citologia",
        "Reino vegetal / fungos",
        "Reino animal",
        "Parasitologia",
        "Evolução biológica",
        "Histologia",
    ],
}

TITLE_FIELD_BY_TABLE = {
    "exams": "title",
    "projetos": "nome",
}


@dataclass
class LabelPrediction:
    label: str | None
    confidence: float | None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Enriquece question_contents de exams/projetos usando GLiNER2.",
    )
    parser.add_argument("--table", choices=("exams", "projetos"), default="exams")
    parser.add_argument("--record-id", help="ID específico do registro no Supabase.")
    parser.add_argument(
        "--limit",
        type=int,
        default=1,
        help="Quantidade máxima de registros buscados quando --record-id não for usado.",
    )
    parser.add_argument(
        "--input-file",
        help="Arquivo JSON local com question_contents ou registros exportados.",
    )
    parser.add_argument(
        "--output-file",
        help="Arquivo JSON de saída para salvar o question_contents enriquecido.",
    )
    parser.add_argument(
        "--env-file",
        default=".env.local",
        help="Arquivo de ambiente com VITE_SIMULADO_SUPABASE_URL/KEY.",
    )
    parser.add_argument(
        "--model",
        default="fastino/gliner2-base-v1",
        help="Modelo Hugging Face do GLiNER2.",
    )
    parser.add_argument(
        "--map-location",
        default="cpu",
        help="Dispositivo do modelo. Padrão: cpu.",
    )
    parser.add_argument(
        "--min-subject-confidence",
        type=float,
        default=0.45,
        help="Confiança mínima para aceitar a disciplina canônica.",
    )
    parser.add_argument(
        "--min-topic-confidence",
        type=float,
        default=0.35,
        help="Confiança mínima para aceitar o tópico canônico.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Atualiza o question_contents no Supabase.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Não faz PATCH no Supabase; apenas imprime um preview.",
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


def require_env(name: str) -> str:
    value = os.getenv(name)
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
) -> Any:
    headers = {
        "apikey": api_key,
        "Authorization": f"Bearer {api_key}",
    }

    body = None
    if payload is not None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json"
        headers["Prefer"] = "return=representation"

    request = urllib.request.Request(
        f"{base_url}/rest/v1/{path}",
        data=body,
        headers=headers,
        method=method,
    )

    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            content = response.read().decode("utf-8")
            return json.loads(content) if content else None
    except urllib.error.HTTPError as error:
        details = error.read().decode("utf-8", errors="ignore")
        raise SystemExit(
            f"Erro HTTP {error.code} ao chamar Supabase em {path}: {details}"
        ) from error


def fetch_records(
    base_url: str,
    api_key: str,
    table: str,
    record_id: str | None,
    limit: int,
) -> list[dict[str, Any]]:
    select = f"id,{TITLE_FIELD_BY_TABLE[table]},question_contents"
    params = {"select": select}
    if record_id:
        params["id"] = f"eq.{record_id}"
    else:
        params["limit"] = str(limit)

    query = urllib.parse.urlencode(params)
    result = supabase_request(base_url, api_key, f"{table}?{query}")
    if not isinstance(result, list):
        raise SystemExit("Resposta inesperada do Supabase ao buscar registros.")
    return result


def update_question_contents(
    base_url: str,
    api_key: str,
    table: str,
    record_id: str,
    question_contents: list[dict[str, Any]],
) -> Any:
    query = urllib.parse.urlencode({"id": f"eq.{record_id}"})
    return supabase_request(
        base_url,
        api_key,
        f"{table}?{query}",
        method="PATCH",
        payload={"question_contents": question_contents},
    )


def build_extractor(model_name: str, map_location: str):
    try:
        from gliner2 import GLiNER2
    except ImportError as error:
        raise SystemExit(
            "GLiNER2 não está instalado. Rode `pip install gliner2` em um venv antes."
        ) from error

    return GLiNER2.from_pretrained(model_name, map_location=map_location)


def parse_label_prediction(raw_result: Any, field_name: str) -> LabelPrediction:
    value = raw_result.get(field_name) if isinstance(raw_result, dict) else None

    if isinstance(value, dict):
        label = value.get("label")
        confidence = value.get("confidence")
        return LabelPrediction(
            label=str(label).strip() if label else None,
            confidence=float(confidence) if confidence is not None else None,
        )

    if isinstance(value, str):
        return LabelPrediction(label=value.strip(), confidence=None)

    return LabelPrediction(label=None, confidence=None)


def classify_single(
    extractor: Any,
    text: str,
    field_name: str,
    labels: list[str],
) -> LabelPrediction:
    raw_result = extractor.classify_text(
        text,
        {field_name: labels},
        include_confidence=True,
    )
    return parse_label_prediction(raw_result, field_name)


def as_text(value: Any) -> str | None:
    if isinstance(value, str):
        cleaned = value.strip()
        return cleaned or None
    if isinstance(value, dict):
        text = value.get("text")
        return as_text(text)
    return None


def as_keywords(value: Any) -> list[str]:
    if isinstance(value, list):
        normalized = []
        for item in value:
            text = as_text(item)
            if text:
                normalized.append(text)
        return normalized[:4]

    text = as_text(value)
    if not text:
        return []

    return [part.strip() for part in text.split(",") if part.strip()][:4]


def extract_summary(extractor: Any, text: str) -> tuple[str | None, list[str]]:
    raw_result = extractor.extract_json(
        text,
        {
            "question": [
                "summary::str::Resumo curto do conteúdo principal em até 6 palavras",
                "keywords::list::Até 4 palavras-chave centrais do conteúdo",
            ]
        },
    )

    if not isinstance(raw_result, dict):
        return None, []

    records = raw_result.get("question")
    if not isinstance(records, list) or not records:
        return None, []

    first_record = records[0]
    if not isinstance(first_record, dict):
        return None, []

    return as_text(first_record.get("summary")), as_keywords(first_record.get("keywords"))


def canonical_label(subject: str | None, topic: str | None) -> str | None:
    if topic is None:
        return None
    if subject is None:
        return topic
    if topic.casefold().startswith(subject.casefold()):
        return topic
    return f"{subject} - {topic}"


def build_gliner_payload(
    extractor: Any,
    model_name: str,
    text: str,
    min_subject_confidence: float,
    min_topic_confidence: float,
) -> dict[str, Any]:
    area_prediction = classify_single(extractor, text, "area", AREA_LABELS)

    subjects = SUBJECT_LABELS.get(area_prediction.label or "", [])
    subject_prediction = (
        classify_single(extractor, text, "subject", subjects)
        if subjects
        else LabelPrediction(label=None, confidence=None)
    )

    topics = TOPIC_LABELS.get(subject_prediction.label or "", [])
    topic_prediction = (
        classify_single(extractor, text, "topic", topics)
        if topics
        else LabelPrediction(label=None, confidence=None)
    )

    summary, keywords = extract_summary(extractor, text)

    trusted_subject = (
        subject_prediction.label
        if subject_prediction.label
        and (
            subject_prediction.confidence is None
            or subject_prediction.confidence >= min_subject_confidence
        )
        else None
    )
    trusted_topic = (
        topic_prediction.label
        if topic_prediction.label
        and (
            topic_prediction.confidence is None
            or topic_prediction.confidence >= min_topic_confidence
        )
        else None
    )

    return {
        "model": model_name,
        "sourceText": text,
        "suggestedArea": area_prediction.label,
        "suggestedAreaConfidence": area_prediction.confidence,
        "suggestedSubject": trusted_subject,
        "suggestedSubjectConfidence": subject_prediction.confidence,
        "suggestedTopic": trusted_topic,
        "suggestedTopicConfidence": topic_prediction.confidence,
        "suggestedLabel": canonical_label(trusted_subject, trusted_topic),
        "approvedLabel": None,
        "reviewStatus": "pending",
        "summary": summary,
        "keywords": keywords,
        "classifiedAt": datetime.now(timezone.utc).isoformat(),
    }


def iter_question_contents(payload: Any) -> Iterable[dict[str, Any]]:
    if isinstance(payload, list):
        for item in payload:
            if isinstance(item, dict):
                yield item


def question_text(item: dict[str, Any]) -> str | None:
    for field_name in ("content", "conteudo", "topic", "topico"):
        value = item.get(field_name)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def enrich_question_contents(
    extractor: Any,
    model_name: str,
    question_contents: list[dict[str, Any]],
    min_subject_confidence: float,
    min_topic_confidence: float,
) -> list[dict[str, Any]]:
    enriched: list[dict[str, Any]] = []

    for item in question_contents:
        cloned = dict(item)
        source_text = question_text(cloned)
        if source_text:
            cloned["gliner"] = build_gliner_payload(
                extractor,
                model_name,
                source_text,
                min_subject_confidence=min_subject_confidence,
                min_topic_confidence=min_topic_confidence,
            )
        enriched.append(cloned)

    return enriched


def load_input_file(input_file: str) -> list[dict[str, Any]]:
    payload = json.loads(Path(input_file).read_text(encoding="utf-8"))

    if isinstance(payload, dict) and isinstance(payload.get("question_contents"), list):
        return list(iter_question_contents(payload["question_contents"]))

    if isinstance(payload, list):
        return list(iter_question_contents(payload))

    raise SystemExit(
        "Arquivo de entrada inválido. Esperado array de question_contents ou objeto com question_contents."
    )


def print_preview(records: list[dict[str, Any]], table: str) -> None:
    preview = []
    title_field = TITLE_FIELD_BY_TABLE.get(table, "title")

    for record in records:
        question_contents = record.get("question_contents") or []
        first_items = []
        for item in list(iter_question_contents(question_contents))[:3]:
            first_items.append(
                {
                    "questionNumber": item.get("questionNumber")
                    or item.get("numero")
                    or item.get("questao"),
                    "content": question_text(item),
                    "gliner": item.get("gliner"),
                }
            )
        preview.append(
            {
                "id": record.get("id"),
                title_field: record.get(title_field),
                "question_contents": first_items,
            }
        )

    print(json.dumps(preview, ensure_ascii=False, indent=2))


def main() -> int:
    args = parse_args()

    if args.input_file and args.apply:
        raise SystemExit("--apply não pode ser usado junto com --input-file.")

    if args.apply and args.dry_run:
        raise SystemExit("Use apenas um entre --apply e --dry-run.")

    load_env_file(args.env_file)

    extractor = build_extractor(args.model, args.map_location)

    if args.input_file:
        question_contents = load_input_file(args.input_file)
        enriched = enrich_question_contents(
            extractor,
            args.model,
            question_contents,
            min_subject_confidence=args.min_subject_confidence,
            min_topic_confidence=args.min_topic_confidence,
        )

        if args.output_file:
            Path(args.output_file).write_text(
                json.dumps(enriched, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
        else:
            print(json.dumps(enriched[:3], ensure_ascii=False, indent=2))
        return 0

    base_url = require_env("VITE_SIMULADO_SUPABASE_URL")
    api_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or require_env(
        "VITE_SIMULADO_SUPABASE_KEY"
    )

    records = fetch_records(
        base_url,
        api_key,
        args.table,
        record_id=args.record_id,
        limit=args.limit,
    )
    if not records:
        raise SystemExit("Nenhum registro encontrado para enriquecer.")

    updated_records: list[dict[str, Any]] = []
    for record in records:
        question_contents = list(iter_question_contents(record.get("question_contents")))
        if not question_contents:
            updated_records.append(record)
            continue

        enriched = enrich_question_contents(
            extractor,
            args.model,
            question_contents,
            min_subject_confidence=args.min_subject_confidence,
            min_topic_confidence=args.min_topic_confidence,
        )

        cloned = dict(record)
        cloned["question_contents"] = enriched
        updated_records.append(cloned)

        if args.apply:
            update_question_contents(
                base_url,
                api_key,
                args.table,
                str(record["id"]),
                enriched,
            )

    if args.output_file:
        Path(args.output_file).write_text(
            json.dumps(updated_records, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    print_preview(updated_records, args.table)
    return 0


if __name__ == "__main__":
    sys.exit(main())
