#!/usr/bin/env python3
"""MLX Embedding service for Stone notes app.

This script runs as a subprocess, reading JSON commands from stdin
and outputting embedding results to stdout.

Commands:
- {"cmd": "embed", "text": "..."} - Generate embedding for single text
- {"cmd": "batch", "texts": [...]} - Generate embeddings for multiple texts
- {"cmd": "ping"} - Health check, returns model info
"""

import sys
import json
import os

# Suppress unnecessary warnings
os.environ["TOKENIZERS_PARALLELISM"] = "false"

# Lazy load model to speed up initial ping
_model = None

def get_model():
    """Lazy load the sentence transformer model."""
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        # BGE-small-en-v1.5: 384 dimensions, ~130MB, good quality/size tradeoff
        _model = SentenceTransformer('BAAI/bge-small-en-v1.5')
    return _model


def get_embedding(text: str) -> list[float]:
    """Generate 384-dimensional embedding for text.

    Args:
        text: Input text to embed

    Returns:
        List of 384 floats (normalized embedding)
    """
    model = get_model()
    # Normalize embeddings for cosine similarity
    embedding = model.encode(text, normalize_embeddings=True)
    return embedding.tolist()


def get_batch_embeddings(texts: list[str]) -> list[list[float]]:
    """Generate embeddings for multiple texts efficiently.

    Args:
        texts: List of input texts

    Returns:
        List of embeddings (each is 384 floats)
    """
    model = get_model()
    embeddings = model.encode(texts, normalize_embeddings=True)
    return [e.tolist() for e in embeddings]


def main():
    """Main loop: read JSON lines from stdin, output results to stdout."""
    # Unbuffered output for real-time communication
    sys.stdout.reconfigure(line_buffering=True)

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        try:
            data = json.loads(line)
            request_id = data.get('id')
            cmd = data.get('cmd')

            if cmd == 'embed':
                text = data.get('text', '')
                if not text:
                    result = {'ok': False, 'error': 'No text provided', 'id': request_id}
                else:
                    embedding = get_embedding(text)
                    result = {'ok': True, 'embedding': embedding, 'id': request_id}

            elif cmd == 'batch':
                texts = data.get('texts', [])
                if not texts:
                    result = {'ok': False, 'error': 'No texts provided', 'id': request_id}
                else:
                    embeddings = get_batch_embeddings(texts)
                    result = {'ok': True, 'embeddings': embeddings, 'id': request_id}

            elif cmd == 'ping':
                result = {
                    'ok': True,
                    'model': 'BAAI/bge-small-en-v1.5',
                    'dims': 384,
                    'id': request_id
                }

            else:
                result = {'ok': False, 'error': f'Unknown command: {cmd}', 'id': request_id}

            print(json.dumps(result), flush=True)

        except json.JSONDecodeError as e:
            print(json.dumps({'ok': False, 'error': f'Invalid JSON: {e}'}), flush=True)
        except Exception as e:
            print(json.dumps({'ok': False, 'error': str(e)}), flush=True)


if __name__ == '__main__':
    main()
