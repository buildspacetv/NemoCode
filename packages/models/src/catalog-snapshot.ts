/**
 * Offline snapshot of the Nebius Token Factory verbose model catalog
 * (GET /v1/models?verbose=true), captured 2026-07-26. Used as the fallback
 * when the live fetch fails or has not run yet, and as the deterministic
 * source for the named model constants the test-suite imports.
 *
 * Regenerate with: pnpm -F @nemocode/cli exec nemocode ... (see
 * scripts/list-nebius-models.mjs) or re-run the capture in the models package.
 * Only the fields buildCatalog() reads are kept.
 *
 * The seven `nvidia/*` rows were captured from the live verbose endpoint on
 * 2026-08-16; their ids, modalities, context lengths and prices are real. Note
 * that all but Nemotron-3-Nano-30B report the placeholder context_length 8000,
 * which CURATED_OVERRIDES.minContext corrects - see index.ts.
 */
import type { NebiusApiModel } from "./index.js";

export const CATALOG_SNAPSHOT: readonly NebiusApiModel[] = [
  {
    id: "Qwen/Qwen2.5-VL-72B-Instruct",
    name: "Qwen2.5-VL-72B-Instruct",
    description:
      "High-end multimodal model delivering strong vision-language reasoning with long-context support.",
    context_length: 32000,
    architecture: {
      modality: "text+image->text",
    },
    pricing: {
      prompt: "0.00000025",
      completion: "0.00000075",
      image: "0",
    },
  },
  {
    id: "MiniMaxAI/MiniMax-M3",
    name: "MiniMax-M3",
    description:
      "MiniMax-M3 is a 428B MoE reasoning model with 1M context, served on B200 via vLLM with EAGLE3 speculative decoding.",
    context_length: 8000,
    architecture: {
      modality: "text->text",
    },
    pricing: {
      prompt: "0.0000003",
      completion: "0.0000012",
      image: "0",
    },
  },
  {
    id: "nvidia/Nemotron-3-Ultra-550b-a55b",
    name: "Nemotron-3-Ultra-550b-a55b",
    description:
      "NVIDIA's flagship Nemotron 3 mixture-of-experts model (550B total, 55B active per token), built for long-horizon reasoning, agentic tool use, and coding.",
    context_length: 8000,
    architecture: {
      modality: "text->text",
    },
    pricing: {
      prompt: "0.000001",
      completion: "0.000003",
      image: "0",
    },
  },
  {
    id: "nvidia/nemotron-3-super-120b-a12b",
    name: "nemotron-3-super-120b-a12b",
    description:
      "Mid-tier Nemotron 3 mixture-of-experts model (120B total, 12B active per token) balancing throughput and reasoning depth for everyday agentic coding.",
    context_length: 8000,
    architecture: {
      modality: "text->text",
    },
    pricing: {
      prompt: "0.0000003",
      completion: "0.0000009",
      image: "0",
    },
  },
  {
    id: "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B",
    name: "NVIDIA-Nemotron-3-Nano-30B-A3B",
    description:
      "Small, fast Nemotron 3 mixture-of-experts model (30B total, 3B active per token) with a genuine 256K context, built for high-throughput background turns.",
    context_length: 262144,
    architecture: {
      modality: "text->text",
    },
    pricing: {
      prompt: "0.00000006",
      completion: "0.00000024",
      image: "0",
    },
  },
  {
    id: "nvidia/Cosmos3-Super-Reasoner",
    name: "Cosmos3-Super-Reasoner",
    description:
      "NVIDIA Cosmos 3 vision-language reasoner: understands screenshots, diagrams, and spatial layouts, and reasons over what it sees. The only NVIDIA model on Nebius that accepts image input.",
    context_length: 8000,
    architecture: {
      modality: "text+image->text",
    },
    pricing: {
      prompt: "0.0000001",
      completion: "0.0000003",
      image: "0",
    },
  },
  {
    id: "nvidia/Nemotron-3_5-Lightning",
    name: "Nemotron-3_5-Lightning",
    description: "Latency-optimised Nemotron 3.5 model for fast, cheap turns.",
    context_length: 8000,
    architecture: {
      modality: "text->text",
    },
    pricing: {
      prompt: "0.00000006",
      completion: "0.00000024",
      image: "0",
    },
  },
  {
    id: "nvidia/Nemotron-3-Nano-Omni",
    name: "Nemotron-3-Nano-Omni",
    description:
      "Nemotron 3 Nano Omni variant. Nebius currently serves it with a text-only modality.",
    context_length: 8000,
    architecture: {
      modality: "text->text",
    },
    pricing: {
      prompt: "0.00000006",
      completion: "0.00000024",
      image: "0",
    },
  },
  {
    id: "nvidia/Llama-3_1-Nemotron-Ultra-253B-v1",
    name: "Llama-3_1-Nemotron-Ultra-253B-v1",
    description:
      "Previous-generation Nemotron built on Llama 3.1 (253B dense), tuned with neural architecture search for reasoning and tool use.",
    context_length: 8000,
    architecture: {
      modality: "text->text",
    },
    pricing: {
      prompt: "0.0000006",
      completion: "0.0000018",
      image: "0",
    },
  },
  {
    id: "Qwen/Qwen3.5-397B-A17B",
    name: "Qwen3.5-397B-A17B",
    description:
      "Multimodal model featuring a Hybrid Mixture-of-Experts architecture, designed for state-of-the-art performance across chat, retrieval-augmented generation, vision-language understanding, video understanding, and agentic workflows",
    context_length: 262144,
    architecture: {
      modality: "text->text",
    },
    pricing: {
      prompt: "0.0000006",
      completion: "0.0000036",
      image: "0",
    },
  },
  {
    id: "deepseek-ai/DeepSeek-V4-Pro",
    name: "DeepSeek-V4-Pro",
    description:
      "DeepSeek-V4 is designed for advanced reasoning, coding, and long-horizon agent workflows, with strong performance across knowledge, math, and software engineering benchmarks.",
    context_length: 1048576,
    architecture: {
      modality: "text->text",
    },
    pricing: {
      prompt: "0.00000175",
      completion: "0.0000035",
      image: "0",
    },
  },
  {
    id: "zai-org/GLM-5.2",
    name: "GLM-5.2",
    description:
      "Zhipu AI's latest flagship multimodal model with strong bilingual (Chinese-English) reasoning, long-context understanding, advanced tool use, and agent-oriented capabilities.",
    context_length: 8000,
    architecture: {
      modality: "text->text",
    },
    pricing: {
      prompt: "0.0000014",
      completion: "0.0000044",
      image: "0",
    },
  },
];
