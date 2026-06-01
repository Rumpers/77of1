# Pitfalls Research

**Domain:** Creator-likeness LoRA image generation spike (real person, photoreal, founder-internal)
**Researched:** 2026-06-01
**Confidence:** HIGH (technical/ops), HIGH (legal/consent), MEDIUM (process)

---

## Bucket 1 — Technical / Quality Pitfalls

### Pitfall T1: Overfitting — "Same-Face" Collapse

**What goes wrong:**
The LoRA memorises a handful of near-identical facial angles rather than learning a generalisable identity representation. Every generation returns the same near-photocopy of one training frame: same lighting, same expression, same skin-texture artifacting. Outputs look credible only when the prompt matches training conditions and fall apart on any novel pose or lighting.

**Why it happens:**
Too many steps (epochs) on a small dataset; or the dataset itself has low pose/lighting variance so the model has nothing to generalise from. Five images shot against the same wall under the same ring-light will produce this regardless of step count. A common misread is "more steps = better identity" — past ~10 epochs on a small set, you are overwriting generalisation.

**How to avoid:**
- Target 20–30 images, not 100+, but require genuine variety: multiple lighting conditions (daylight/indoor/outdoor), at least four distinct angles (full-face, 3/4, profile, slight downward/upward), and different backgrounds.
- Cap training at 10 epochs maximum for the first pass; use 5–7 as the default; inspect samples at the halfway point before letting the run complete.
- Generate periodic samples every 200–300 training steps with a fixed seed and a neutral "portrait photograph of [trigger]" prompt to watch for convergence-vs-collapse.

**Warning signs:**
Every output shows identical cheekbone lighting; skin texture is "painted" or waxy; close-up prompts and full-body prompts produce the same cropped face regardless of phrasing.

**Phase to address:**
Dataset curation phase (before any training run); validated with a 5-image sample eval at 50% of target epoch count.

---

### Pitfall T2: Dataset Too Small and Too Uniform

**What goes wrong:**
A LoRA trained only on close-ups cannot generalise body shape, height, or how the face looks at distance. A LoRA trained only on one clothing item will bake that wardrobe into identity ("wardrobe bleed"). The model refuses to place the subject in novel environments because it has never seen her in one.

**Why it happens:**
Founders/operators grab whatever photos are available rather than auditing for coverage gaps. For a creator whose public photos are mostly selfies at the same angle, this is the default state.

**How to avoid:**
Before training, build a coverage checklist: (a) at least 3 distinct background contexts, (b) both close-up and at least one mid-body or full-body frame, (c) at least 2 very different clothing items, (d) at least 3 clearly different lighting conditions. Reject any dataset that fails more than one criterion without a re-shoot plan.

**Warning signs:**
All source images are selfies, or all are from the same photo shoot; founder says "she sent me her best photos."

**Phase to address:**
Dataset intake / curation — a structured audit checklist before any GPU spend is authorised.

---

### Pitfall T3: Auto-Captioning Breaking Identity Learning

**What goes wrong:**
Running BLIP, WD14, or any auto-captioner over training images will describe the subject's hair colour, eye colour, facial structure, and skin tone in the caption text. The model then explains those features via the caption rather than binding them to the trigger word. Result: the trigger word triggers clothing, framing, and background — but not the face. Changing the prompt adjectives ("blue eyes") overrides the LoRA because the captions already told the model that is just a description.

**Why it happens:**
Auto-captioning is the default in most GUI training tools (Kohya, FLUX Gym, ostris ai-toolkit). Users accept the default without understanding that for a person LoRA, facial features must be left unexplained so they bond to the trigger.

**How to avoid:**
Do not use auto-captioning for the facial/body features. Caption images manually or with a script that strips appearance descriptors. Captions should describe only: background, lighting condition, pose, and art-style/photo-style. All distinctive facial and physical features must be left out of the caption so the model has no explanation for them except the trigger.

**Warning signs:**
BLIP captions contain phrases like "a woman with brown hair and dark eyes"; generated images show the right framing and lighting but the face looks like a generic stock-photo person rather than the creator.

**Phase to address:**
Dataset preparation phase, immediately after image curation and before the first training run.

---

### Pitfall T4: Wrong Base Model for Photoreal Output

**What goes wrong:**
Training a photoreal person LoRA on a base model designed for anime or illustration. Illustrious XL is outstanding for illustrated content but produces uncanny skin texture on photorealistic portraits. Using it as the base means the LoRA learns against a feature space that structurally resists photoreal skin, lighting physics, and hair strands.

**Why it happens:**
Illustrious XL is mentioned in the lala.la roadmap as the planned base model. It is an excellent model but its sweet spot is illustrated/anime output, not photographic likeness work. The distinction is not obvious to someone reading the roadmap note without context.

**How to avoid:**
For the photoreal likeness spike, use FLUX.1-dev or FLUX.1-schnell as the base (superior photorealism, better skin-texture fidelity, stronger prompt adherence on portraits). Illustrious XL should be revisited only if the product pivots to illustrated or anime-style content. Document this choice explicitly in the spike findings so the roadmap note can be corrected.

**Warning signs:**
Training runs but skin looks painted; hair looks illustrated; lighting behaves like an ink rendering even on photo prompts.

**Phase to address:**
Base model selection — must be locked before the first training run. This is a 0-cost decision; the only cost is time to re-run if wrong.

---

### Pitfall T5: LoRA Strength Miscalibration at Inference

**What goes wrong:**
LoRA weight (strength) defaults (typically 0.7–1.0) are too high for a well-trained photoreal person LoRA. Outputs become hyper-specific to the training distribution: same expression, same slight head tilt, plastic skin texture, "baked-in" lighting. Lowering too much causes identity to fade. The spike uses a default and calls it "the result" without exploring the dial.

**Why it happens:**
Evaluation is done with whatever default the inference tool sets. Without systematic grid testing of LoRA strength, the eval gallery reflects the default setting, not the model's actual range.

**How to avoid:**
Run every inference evaluation as a grid: test LoRA weights at 0.6, 0.75, 0.85, and 1.0 for the same seed and prompt. Include the strength value on every gallery output filename. The sweet spot for photoreal person LoRAs is typically 0.7–0.85; document the chosen value in the findings.

**Warning signs:**
Every gallery output looks identical; founder says "they all look a bit plastic"; no strength value is recorded anywhere in the spike notes.

**Phase to address:**
Inference / eval gallery phase. Treat strength as a parameter that must be reported alongside each output.

---

### Pitfall T6: Artifacts on Hands and Identity Drift in Non-Portrait Crops

**What goes wrong:**
Hands are structurally difficult for diffusion models across all base models. At full-body or mid-body crops, hand artifacts (six fingers, fused digits, wrong proportions) appear. Additionally, identity "drifts" at distances — the face that looks correct at portrait crop stops looking like the creator when the camera pulls back to 3/4 or full body, because the LoRA was trained mostly on close-ups.

**Why it happens:**
Hands are a known unsolved weakness. Identity drift at distance reflects the training data distribution: if 80% of training images are head-and-shoulders shots, the model has weak identity signal for full-body compositions.

**How to avoid:**
For the go/no-go spike, treat hand artifacts and identity drift at distance as expected and document them as findings rather than failures. Set the spike's success criteria to face-crop quality only. If face crops pass and full-body fails, the finding is "LoRA works for head-and-shoulders use cases; full-body requires re-training with better dataset coverage." Do not try to fix hand artifacts during the spike — that is a post-go/no-go problem.

**Warning signs:**
Evaluating outputs with hands in frame and counting that against the LoRA quality score; testing full-body without having trained on full-body images.

**Phase to address:**
Go/no-go criteria definition — success criteria must explicitly scope to face-crop use cases. Defined before any training starts.

---

### Pitfall T7: Reproducibility — No Config or Seed Logging

**What goes wrong:**
A training run produces good results. The founder cannot reproduce it. Training config (steps, rank, alpha, learning rate, batch size, base model hash, dataset filenames) was not saved. The .safetensors file exists but there is no record of how to re-train if the file is lost, the training run had bugs discovered later, or parameters need to be adjusted.

**Why it happens:**
Spike mindset: "I just want to see if it works." Logging feels like overhead. But a spike exists to produce reusable knowledge, and knowledge you cannot reproduce is not knowledge.

**How to avoid:**
Save the full training config JSON/TOML file alongside the .safetensors output. Save the dataset manifest (list of training image filenames and their captions). Record base model identifier and version hash. Record the fixed inference seed used for eval. Commit all of this to the spike's artifact directory before the go/no-go review.

**Warning signs:**
The only output is the .safetensors file and some screenshots; no config file, no dataset list, no record of what was tried vs rejected.

**Phase to address:**
Training run setup — add a "what to save" checklist to the spike's Definition of Done before the first run.

---

## Bucket 2 — Cost / Ops Pitfalls

### Pitfall C1: Idle GPU Billing — Forgotten Running Instance

**What goes wrong:**
A GPU pod on RunPod, Modal, or Replicate is started for training, the run completes, and the pod is left running. An A100 at $2–$4/hour costs $48–$96/day idle. A spike that "costs $5 to train" turns into a $300 surprise bill because the pod ran for 4 days post-training.

**Why it happens:**
Training UIs do not auto-terminate. RunPod pods persist until manually stopped. The founder starts a run, closes the browser tab, forgets. Off-hours runs are highest risk (no one watching the dashboard).

**How to avoid:**
- Use RunPod's auto-stop-on-idle feature, or use Modal's serverless mode which terminates on job completion by default.
- Set a spending alert before any GPU session starts.
- Use RunPod's "1-hour balance top-up" trigger to auto-pause the pod.
- For a spike, prefer Modal's serverless function pattern (the function returns, the GPU releases) over a persistent pod.
- Document in the spike playbook: "After training completes, destroy the pod immediately. Do not use the pod for inference testing — use a separate short-lived inference run."

**Warning signs:**
Pod started at 10pm, founder does not check until next morning; no spending alerts configured; no auto-stop configured.

**Phase to address:**
Spike infrastructure setup — configure auto-stop and spending alerts before the first run.

---

### Pitfall C2: Slow Iteration Due to Re-Running From Scratch

**What goes wrong:**
Every trial runs a full training job from step 0. A 500-step run takes 10–20 minutes and $0.50–$2.00. Fine-tuning iterations happen 10–15 times in a spike. Not checkpointing intermediate epochs means every adjustment costs a full run.

**Why it happens:**
Checkpointing is off by default in many training tools. Founders run to 100% completion because that is what "done" looks like to them.

**How to avoid:**
Configure the training tool to save a checkpoint every 100–200 steps. This allows resuming from a good intermediate state if the full run overfits, and allows comparing epoch-N vs epoch-2N quality without separate full runs. Checkpoints cost storage (a few hundred MB each) not compute.

**Warning signs:**
Every iteration is a full run; no checkpoint files in the output directory; "it looked good at step 300 but I let it run to 500 and now it's worse."

**Phase to address:**
Training run setup — enable checkpoint saves before the first run.

---

### Pitfall C3: Vendor Lock-In via Non-Exportable Weights

**What goes wrong:**
Some hosted training services (primarily certain consumer-facing "train-a-model-of-yourself" platforms) retain the trained weights server-side and expose only an API to the model. The creator's likeness LoRA cannot be downloaded as a .safetensors file, cannot be moved to a different host, and is permanently dependent on the vendor's continued operation and pricing.

**Why it happens:**
Consumer platforms (not RunPod/Modal/Replicate proper) often package "train your avatar" as a product feature, not a raw training service. The lock-in is the product.

**How to avoid:**
Use only platforms that explicitly support .safetensors download from the training run (RunPod + Kohya/ostris ai-toolkit, Modal custom container, Replicate training API with explicit output model export). Verify export capability before the first paid run. Confirm you can download the file to local storage and that the platform's terms do not claim ownership of trained weights.

The PROJECT.md states: "the creator owns her likeness, LoRA, voice clone, and conversation history under a non-exclusive license and can take them back at any time." This is only enforceable if lala.la actually possesses the .safetensors file. A locked vendor destroys this guarantee.

**Warning signs:**
The training platform has no "download model" button; the trained model is described as a "deployment" or "endpoint" rather than a file; the terms of service mention "models trained on our platform remain on our infrastructure."

**Phase to address:**
Vendor selection — resolve export capability before any training spend is authorised.

---

### Pitfall C4: Source Photo Data Retention on Third-Party Hosts

**What goes wrong:**
Training photos of Claire are uploaded to a GPU host's cloud storage or a managed training service. The host's data retention policy keeps those images indefinitely (or trains on them, or stores them accessibly to infrastructure staff). The photos were given by Claire for the AI twin text product; whether she consented to them being stored on a third-party GPU provider's infrastructure is ambiguous.

**Why it happens:**
Replicate's web-interface predictions are "kept indefinitely." Other services have similar patterns. Default upload-and-train workflows do not prompt the user to think about data residency.

**How to avoid:**
- Review the host's data retention policy before uploading any real person's photos. Prefer platforms that explicitly offer: (a) user-controlled deletion, (b) no training on uploaded user data, (c) clear data-residency region.
- Delete training images from the platform immediately after the training run completes; do not leave them as "convenient backup."
- Use RunPod persistent volumes with explicit deletion after run, or Modal with ephemeral storage that is destroyed when the function terminates.
- Do not use consumer image-to-avatar services for this work — their privacy terms are consistently weaker than raw GPU compute providers.

**Warning signs:**
The training platform's privacy policy is absent, vague, or says "we may use content to improve our services"; no explicit data deletion after training.

**Phase to address:**
Vendor selection and pre-run checklist — data retention policy review is a gate before any creator photos leave lala.la's control.

---

## Bucket 3 — Legal / Ethical / Consent Pitfalls

### Pitfall L1: Existing Consent Scope Does Not Cover Synthetic Image Generation

**What goes wrong:**
Claire's consent was obtained for an "AI digital twin" in the context of chat interaction — text responses, voice replies, and potentially her photo being used as a chat avatar. Generating novel synthetic photorealistic images of her likeness is a meaningfully different use: it produces new content that did not exist, in contexts and appearances she did not choose, and which could be redistributed or misused.

**Why it happens:**
Operators assume broad "AI twin" consent covers everything AI can do. It does not. Consent must be informed and specific. California AB 2602 (effective 2025) requires that consent for AI replica use describe the intended uses "with reasonable specificity." A vague "we may use AI" clause does not cover synthetic image generation of her face.

**How to avoid:**
Before training a LoRA on Claire's photos, obtain explicit written consent specifically for: (a) training an image generation model on her photos, (b) generating synthetic images of her likeness, (c) the scope of use — founder-internal evaluation only, not for distribution.

The existing consent should be amended or supplemented with a one-paragraph addendum:
"Creator grants lala.la permission to train an image generation model (LoRA) using the photos provided, and to generate synthetic images of creator's likeness, for internal quality evaluation purposes only. Generated images will not be published, shared with fans, or used commercially without separate written consent."

**Warning signs:**
No written consent specifically mentioning image generation or LoRA training; founder assumes "she's fine with it" based on a verbal conversation; the original consent form mentions only "chat AI" or "voice AI."

**Phase to address:**
Pre-spike gate — the spike does not start until this consent addendum is signed. This is a hard prerequisite, not a to-do.

---

### Pitfall L2: TAKE IT DOWN Act and NCII Exposure — "Defer Policy" Is Not Zero-Risk

**What goes wrong:**
The TAKE IT DOWN Act was signed into federal law on May 19, 2025. Platform enforcement obligations took effect May 19, 2026 — which is now. The law makes publication of non-consensual intimate imagery (including AI-generated synthetic imagery) a federal crime and imposes 48-hour removal obligations on platforms. The milestone deliberately defers full content policy to a later phase. But deferral does not eliminate exposure: even founder-internal outputs can become a liability if generated, stored, or accidentally shared without the right controls.

**Why it happens:**
"Founder-internal only" feels safe. But the risk path is not only from fan-facing distribution — it is also from: (a) the LoRA being used without its SFW-only constraint applied, (b) generated outputs being stored loosely and later shared, or (c) the LoRA itself being trained in a way that makes NSFW generation trivially easy.

**Minimum guardrails that must remain in place even while full content policy is deferred:**

1. SFW-only at inference: Use a base model with default safety filters enabled (FLUX.1-dev includes internal content filtering). Do not disable safety filters during the spike, even to "test what it can do." Explicitly prompt-constrain every generation to clothing-on, non-intimate contexts.

2. Founder-internal storage only: Output images go to a private, access-controlled location (e.g., a private Replit Object Storage bucket, a local encrypted folder). Not shared via messaging apps. Not uploaded to cloud photo services.

3. No uncontrolled LoRA sharing: The .safetensors file must not be shared outside the founding team. It is a capability, not just a file — whoever has it can generate images. Treat it with the same access control as a private signing key.

4. Document the boundary: Write one sentence in the findings doc: "This LoRA was built for internal evaluation. Public deployment requires completion of content policy (Milestone X) and updated creator consent."

**Warning signs:**
Generated images saved in a shared Dropbox or Notion; LoRA file shared via Discord "for feedback"; "negative prompts are for production, not the spike."

**Phase to address:**
Spike definition phase — these guardrails go into the spike's acceptance criteria, not as afterthoughts.

---

### Pitfall L3: Personality Rights and the Non-Exclusive License Boundary

**What goes wrong:**
lala.la's PROJECT.md states the creator operates under a non-exclusive license and "can take them back at any time." This is the right posture — but the LoRA spike must not create an asset that undermines it. Specifically: if the trained LoRA is hosted on a third-party platform that claims rights to models trained on their infrastructure, or if the training process voids the non-exclusive nature of the arrangement, lala.la could lose the ability to honour Claire's right to revoke.

California SB 683 (signed October 2025) amended the right of publicity statute to explicitly include digital replicas — a computer-generated representation "readily identifiable as the voice or visual likeness of an individual." A trained LoRA of Claire's face is a digital replica asset under California law.

**How to avoid:**
- The .safetensors file must be stored where lala.la controls it exclusively (self-hosted or Replit Object Storage under lala.la's account).
- No third-party may acquire a copy unless Claire explicitly consents to that transfer.
- The consent addendum (see L1) should include a clause confirming that the LoRA asset is treated under the same non-exclusive, revocable license as the rest of Claire's digital twin assets.
- Include a deletion procedure: if Claire invokes her right to take back her assets, the .safetensors file and all generated outputs must be deleted from all storage.

**Warning signs:**
LoRA stored only on the GPU training platform because "it's easier to run inference there"; no deletion procedure defined; consent addendum does not mention image generation assets.

**Phase to address:**
Pre-spike gate (same as L1) — storage policy and revocation procedure defined before the first training run.

---

### Pitfall L4: Creator Photo Data on Vendors with Bad Training-on-Data Terms

**What goes wrong:**
Consumer-oriented AI image platforms (Civitai hosted training, certain "train your model" SaaS products) include terms that allow the platform to use uploaded images to improve their own models. Uploading Claire's photos to such a platform means her likeness could be incorporated into the platform's base model training without her knowledge or consent, and without any mechanism for removal.

**Why it happens:**
The default workflow shown in most tutorials uses consumer platforms because they are the easiest. Terms are not read.

**How to avoid:**
Use only raw GPU compute providers (RunPod, Modal, Lambda Labs) where: (a) you run your own training code, (b) the ToS explicitly does not claim training rights over user-uploaded data, (c) data can be deleted after use.

Specifically avoid: Civitai's hosted training, Astria, Lensa AI, and similar consumer "fine-tune your photos" services for this use case. Their convenience does not outweigh the ToS risk.

Before choosing any vendor, answer three questions: (1) Can I download the trained .safetensors file? (2) Does the ToS say you will not use my uploaded images to train your own models? (3) Can I delete my uploaded images after training completes?

**Warning signs:**
The training platform's marketing says "train a model of yourself in 5 minutes"; there is no "delete my data" button; the ToS is longer than 500 words and the words "improve our services" appear.

**Phase to address:**
Vendor selection — a hard gate before any creator photos leave lala.la's infrastructure.

---

## Bucket 4 — Process Pitfalls

### Pitfall P1: Spike Scope Creep into Production Infrastructure

**What goes wrong:**
The spike begins as "train a LoRA and evaluate quality" and ends with: a UI for the founder to generate images, a database table for storing outputs, an API endpoint, a worker queue job, integration with the twin-runtime pipeline, and half-implemented fan-facing delivery — none of which were in scope. Weeks pass. The go/no-go question is never answered because "we're still building."

**Why it happens:**
Founders see the quality results and start imagining the product. The jump from "this looks good" to "let me add this to the app" feels natural. Each addition is small; the accumulated drift is large.

**How to avoid:**
Define and commit in writing — before the first training run — exactly what "done" means for this spike:
- Done = trained LoRA file + 20-image eval gallery + go/no-go findings doc.
- Done does NOT = any new code in the main codebase, any new database tables, any API endpoint, any fan-facing feature.

Create a physical scope boundary: spike outputs go into a dedicated directory (`/spike-outputs/lora-v1/`) and findings go into a doc. Zero changes to `artifacts/`, `lib/`, or any production schema are permitted during this spike.

**Warning signs:**
Founder opens a new branch and starts editing `lib/twin-runtime/`; a schema migration is discussed; any sentence containing "since we're already here, we might as well...".

**Phase to address:**
Spike definition — Definition of Done written and reviewed before any work starts.

---

### Pitfall P2: No Clear Go/No-Go Criteria — Gut Feel Evaluation

**What goes wrong:**
The founder looks at the gallery, says "yeah this looks pretty good," and either (a) launches immediately without a structured evaluation, or (b) keeps iterating indefinitely because "it's not quite there yet" with no definition of "there."

**Why it happens:**
Subjective quality evaluation is the default when criteria are not defined upfront. "Pretty good" is not a threshold.

**How to avoid:**
Define go/no-go criteria before training starts, not after seeing results. A minimal useful set for this spike:

| Criterion | Pass threshold |
|-----------|---------------|
| Face recognition — does the founder recognise Claire in at least 15/20 gallery outputs? | 15/20 |
| Diversity — do the 20 outputs show at least 3 visibly different contexts/poses? | Yes |
| SFW compliance — are all 20 outputs clothing-on and non-intimate? | 20/20 (hard gate) |
| Artifact severity — are hand/anatomy artifacts present in fewer than half? | Under 50% |
| Reproducibility — can the same output be re-generated from a saved seed+config? | Confirm 1 sample |

Document the criteria in the findings doc. Grade against them explicitly.

**Warning signs:**
Go/no-go criteria are written after the gallery is generated; the evaluation is described verbally but not documented; a second training run is started before the first is graded.

**Phase to address:**
Spike definition — criteria locked before training starts.

---

### Pitfall P3: Findings Not Captured in Reusable Form

**What goes wrong:**
The spike completes. The founder has a .safetensors file and some screenshots. In two weeks, the findings are gone — what dataset size worked, why a specific base model was chosen, what negative prompts produced the cleanest results, what failed approaches were tried. The next milestone that builds on this work starts from scratch.

**Why it happens:**
Documentation feels like overhead during a spike. "I'll remember." The next milestone's developer (or the same founder in two weeks) will not.

**How to avoid:**
The spike must produce a findings doc with five sections:
1. Dataset: number of images, coverage gaps identified, captioning approach used.
2. Training: base model chosen and why, step count, rank, alpha, checkpoints tested, what overfitted.
3. Inference: LoRA strength sweet spot, best negative prompts, seed values that produced the best outputs.
4. Results: go/no-go verdict against the explicit criteria.
5. Decisions for the next milestone: what the roadmap should specify (base model, dataset requirements, consent requirements) rather than re-researching.

This doc is the spike's primary output — as important as the .safetensors file.

**Warning signs:**
The only output after the spike is the .safetensors file and a "yeah it looks good" Telegram message; no dataset manifest saved; no record of what was tried and rejected.

**Phase to address:**
Spike completion gate — the findings doc must exist and be reviewed before the go/no-go verdict is communicated to the roadmap.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Use auto-captioning without review | Faster dataset prep | LoRA does not learn face identity; full re-run required | Never for person LoRA |
| Skip per-step sample checkpoints | Simpler training run | Cannot diagnose overfitting point; must re-run from scratch | Never — checkpoint cost is storage only |
| Leave GPU pod running post-training | Easier to test immediately | $50–$200 idle billing surprise | Never — document shutdown in playbook |
| Store training photos on vendor platform indefinitely | Convenient re-training | Creator photo data on third-party infra without consent | Never — delete after run completes |
| Evaluate with default LoRA strength (1.0) | Faster eval | Misrepresents model quality; overcooking artifacts will appear as model failure | Never — always test a strength grid |
| Start building API endpoints during the spike | Feels productive | Scope creep; go/no-go never answered | Never during a defined spike |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Replicate training API | Trusting web-UI data retention (indefinite) for training photos | Use RunPod/Modal with explicit ephemeral storage; delete photos post-run |
| RunPod pods | Starting a pod and not configuring auto-stop | Set auto-shutdown-on-idle AND a spending cap before starting any session |
| FLUX.1-dev | Disabling safety filter to "see what it can do" | Keep safety filters on for all spike inference; SFW-only is a hard gate |
| Kohya / ostris ai-toolkit | Accepting default captioning pipeline | Strip appearance descriptors from captions before training; describe only pose/lighting/background |
| .safetensors export | Using a consumer platform that locks weights | Confirm export capability before paying; verify with a free-tier test first if possible |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Storing the LoRA .safetensors in a public or shared repository | Anyone with the file can generate images of Claire's likeness | Store in private, access-controlled location only; treat as a private key |
| Uploading creator photos to a vendor with "may use to improve services" ToS | Creator's photos incorporated into vendor's base model without consent or revocation path | Review ToS explicitly for three flags before upload; use raw compute providers only |
| No deletion procedure for generated outputs | Generated images accumulate on developer machines, cloud drives, chat apps | Define and execute deletion procedure at spike close; outputs live only in the designated spike directory |
| Using the same LoRA file for both internal eval and any fan-facing test | Conflates the controlled spike with production delivery | Separate namespacing; spike outputs are tagged "internal-eval-only" in the filename/metadata |

---

## "Looks Done But Isn't" Checklist

- [ ] **Consent:** Signed addendum specifically covering LoRA training and synthetic image generation — not just the general AI twin consent
- [ ] **Vendor ToS reviewed:** Three-question checklist answered in writing before photos were uploaded
- [ ] **Training config saved:** Full config JSON/TOML committed alongside .safetensors before eval gallery is reviewed
- [ ] **Dataset manifest saved:** List of training image filenames and their captions archived with the spike outputs
- [ ] **Go/no-go criteria defined upfront:** Written before the first training run, not after seeing the gallery
- [ ] **LoRA strength grid tested:** Eval gallery includes outputs at 4 different strength values, not just the default
- [ ] **GPU pod terminated:** Confirmed destroyed immediately after training and inference runs completed
- [ ] **Training photos deleted from vendor:** Confirmed deletion from vendor storage after .safetensors was downloaded
- [ ] **Findings doc written:** Five-section findings doc completed before go/no-go verdict is communicated

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Overfitting discovered after full run | LOW | Re-run from checkpoint at 50% steps; or reduce steps in next run; no data cost |
| Auto-captioning broke identity learning | MEDIUM | Re-caption dataset manually (1–3 hours); full re-train required |
| Wrong base model used (Illustrious XL) | MEDIUM | Re-run training on FLUX.1-dev base; dataset and config reusable |
| Idle GPU billing surprise | LOW-MEDIUM | Terminate pod; file billing dispute with vendor if egregious; add auto-stop to playbook |
| Creator photos left on vendor platform | HIGH (consent/trust) | Request immediate deletion via vendor support; amend consent addendum; disclose to Claire |
| No consent addendum for image generation | HIGH (legal/trust) | Pause spike; do not train; obtain consent before restarting; no workaround |
| .safetensors stored on locked vendor | HIGH (portability) | Negotiate export with vendor support; if impossible, retrain on exportable platform; update vendor vetting checklist |
| Findings not captured — findings lost | MEDIUM | Reconstruct from training run logs and screenshots; establish findings-doc requirement before next run |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| T1 Overfitting / same-face | Dataset curation + step budget | Midpoint sample review shows face generalising to novel prompts |
| T2 Dataset too uniform | Dataset intake audit | Coverage checklist passes all 4 criteria before training authorised |
| T3 Auto-captioning | Dataset prep | All captions reviewed; no appearance descriptors present |
| T4 Wrong base model | Pre-run model selection | FLUX.1-dev confirmed as base in training config |
| T5 LoRA strength not calibrated | Inference / eval gallery | Gallery includes 4-strength grid; sweet spot documented |
| T6 Hands / identity drift | Go/no-go criteria | Success criteria explicitly scoped to face-crop; full-body failures documented as findings |
| T7 No reproducibility logging | Training run setup | Config file and dataset manifest committed before eval gallery reviewed |
| C1 Idle GPU billing | Infrastructure setup | Auto-stop configured; spending alert active; confirmed in pre-run checklist |
| C2 Slow iteration / no checkpoints | Training run setup | Checkpoint-every-200-steps enabled before first run |
| C3 Vendor weight lock-in | Vendor selection | .safetensors download tested before paid training run |
| C4 Photo data retention on host | Vendor selection + post-run cleanup | Deletion confirmed within 24h of training completion |
| L1 Consent scope gap | Pre-spike gate (hard prerequisite) | Signed consent addendum in file before any GPU spend |
| L2 TAKE IT DOWN / NCII minimum guardrails | Spike definition + acceptance criteria | SFW-only, founder-internal, no LoRA sharing — written into spike acceptance criteria |
| L3 Personality rights / non-exclusive license | Pre-spike gate | .safetensors storage location confirmed; deletion procedure written |
| L4 Bad vendor ToS | Vendor selection | Three-question ToS checklist answered in writing for chosen vendor |
| P1 Scope creep | Spike Definition of Done | Zero production code changes; scope boundary enforced before first run |
| P2 No go/no-go criteria | Spike definition | Criteria table written and signed off before training starts |
| P3 Findings not captured | Spike completion gate | Five-section findings doc exists before go/no-go verdict is communicated |

---

## Sources

- [MyAIForce — Training a Highly Convincing Real-Life LoRA Model](https://myaiforce.com/real-life-lora-training/) — dataset diversity, overfitting signs — MEDIUM confidence
- [sozee.ai — LoRA Training Methods for AI Influencer Content Consistency](https://sozee.ai/resources/creator-content-consistency-through-lora-training-methods-photorealistic-ai-influencer-platform-comparison/) — wardrobe bleed, identity drift, retraining risks — MEDIUM confidence
- [FLUX.1 LoRA Not Learning Identity — AI Q&A Hub](https://www.aiqnahub.com/ux-1-lora-not-learning-character/) — auto-captioning breaking identity learning — MEDIUM confidence
- [sandner.art — Training Custom LoRA Models](https://sandner.art/ai-for-designers-training-custom-lora-models/) — config save, seed logging, checkpoint practice — MEDIUM confidence
- [RunPod — Cloud GPU Mistakes to Avoid](https://www.runpod.io/articles/guides/cloud-gpu-mistakes-to-avoid) — idle billing, auto-stop, spending caps — HIGH confidence
- [buildmvpfast.com — Scale-to-Zero Serverless GPUs: Modal vs RunPod vs Replicate](https://www.buildmvpfast.com/blog/scale-to-zero-serverless-gpu-modal-runpod-ai-hosting-2026) — cost comparison, billing model — MEDIUM confidence
- [Replicate — Data Retention Policy](https://replicate.com/docs/topics/predictions/data-retention) — web-UI predictions kept indefinitely; API predictions deleted after 1 hour — HIGH confidence
- [TAKE IT DOWN Act — Wikipedia](https://en.wikipedia.org/wiki/TAKE_IT_DOWN_Act) — signed May 19, 2025; platform enforcement May 19, 2026; synthetic imagery covered — HIGH confidence
- [Proskauer — Take It Down Act Signed into Law](https://www.proskauer.com/blog/take-it-down-act-signed-into-law-offering-tools-to-fight-non-consensual-intimate-images-and-creating-a-new-image-takedown-mechanism) — 48-hour removal obligation, NCII definition, synthetic imagery — HIGH confidence
- [influencers-time.com — Take It Down Act: Creator Contracts & Brand Compliance](https://www.influencers-time.com/take-it-down-act-creator-contracts-and-brand-compliance/) — brand/operator liability, FTC enforcement posture — MEDIUM confidence
- [Fenwick — California's New AI Laws Limit Uses of Digital Likeness](https://www.fenwick.com/insights/publications/californias-new-ai-laws-limit-uses-of-digital-likeness) — AB 1836, AB 2602, SB 683 digital replica rights — HIGH confidence
- [Pryor Cashman — California's New AI Laws: What Content Creators Need to Know](https://www.pryorcashman.com/publications/californias-new-ai-laws-what-content-creators-and-ip-owners-need-to-know) — performer consent requirements (AB 2602), "reasonably specific description" requirement — HIGH confidence
- [pxz.ai — Flux vs SDXL 2026](https://pxz.ai/blog/flux-vs-sdxl) — Flux superior for photoreal portraits; SDXL ecosystem larger — MEDIUM confidence
- lala.la PROJECT.md — non-exclusive license, TAKE IT DOWN Act flag, personality rights, creator asset ownership — HIGH confidence (authoritative project source)

---
*Pitfalls research for: Creator-likeness LoRA image generation spike — visual-identity-engine workstream*
*Researched: 2026-06-01*
