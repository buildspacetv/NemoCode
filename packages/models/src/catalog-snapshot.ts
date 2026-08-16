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
 * UNVERIFIED: the four `nvidia/*` rows (Nemotron x3, Cosmos x1) were added
 * without a live catalog read - the capture host could not reach
 * api.tokenfactory.nebius.com. Their ids, context lengths and prices are
 * best-effort and MUST be reconciled against `GET /v1/models?verbose=true`
 * before release; a wrong id makes every session 404. Everything else here is
 * a real capture.
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
    // UNVERIFIED - see file header.
    id: "nvidia/Llama-3_1-Nemotron-Ultra-253B-v1",
    name: "Llama-3_1-Nemotron-Ultra-253B-v1",
    description:
      "NVIDIA's flagship Nemotron reasoning model: a 253B dense Llama derivative tuned with neural architecture search for agentic tool use, long-horizon reasoning, and coding, with a toggleable reasoning mode.",
    context_length: 131072,
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
    // UNVERIFIED - see file header.
    id: "nvidia/Llama-3_3-Nemotron-Super-49B-v1_5",
    name: "Llama-3_3-Nemotron-Super-49B-v1_5",
    description:
      "Mid-sized NVIDIA Nemotron reasoning model balancing throughput and accuracy on a single node, tuned for tool calling, instruction following, and software engineering workflows.",
    context_length: 131072,
    architecture: {
      modality: "text->text",
    },
    pricing: {
      prompt: "0.00000013",
      completion: "0.0000004",
      image: "0",
    },
  },
  {
    // UNVERIFIED - see file header.
    id: "nvidia/NVIDIA-Nemotron-Nano-9B-v2",
    name: "NVIDIA-Nemotron-Nano-9B-v2",
    description:
      "Small, fast NVIDIA Nemotron hybrid Mamba-Transformer model with a runtime thinking budget, built for high-throughput background tasks and cheap agentic turns.",
    context_length: 131072,
    architecture: {
      modality: "text->text",
    },
    pricing: {
      prompt: "0.00000004",
      completion: "0.00000012",
      image: "0",
    },
  },
  {
    // UNVERIFIED - see file header.
    id: "nvidia/Cosmos-Reason1-7B",
    name: "Cosmos-Reason1-7B",
    description:
      "NVIDIA Cosmos Reason is a multimodal vision-language model for physical-world reasoning: it understands screenshots, diagrams, video frames, and spatial layouts, and emits chain-of-thought grounded in what it sees.",
    context_length: 131072,
    architecture: {
      modality: "text+image->text",
    },
    pricing: {
      prompt: "0.00000005",
      completion: "0.00000015",
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
