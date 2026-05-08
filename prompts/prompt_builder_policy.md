# Prompt Builder Policy

This file distills the local OpenAI guide files in:
`/Users/inaminetetsuo/Library/Mobile Documents/com~apple~CloudDocs/AI-Workspace/GPT5-5プロンプティングガイド/`

Use these principles when turning a Japanese user request into an English execution prompt.

## GPT-5.5 prompting principles

- Prefer outcome-first prompts over process-heavy prompt stacks.
- Define what good output looks like, the constraints that matter, and the required final shape.
- Keep instructions short. Add detail only when it changes output behavior.
- Avoid unnecessary `always` / `never` / `must` wording except for true invariants.
- Preserve supplied facts and user intent. Do not invent unsupported specifics just to make the prompt sound stronger.
- Use a validation mindset: the generated execution prompt should be directly usable, editable, and not padded with commentary.

## Responses API use

- Use the Responses API for prompt creation.
- Keep system-level behavior in `instructions`.
- Put variable user content in `input`.
- Read the generated text through `output_text`.
- Use `store: false` for this local prompt-conversion flow unless persistent model-side state is explicitly needed.
- Prefer low reasoning effort and low verbosity for straightforward prompt conversion.

## Image and vision principles

- GPT Image 2 can use text and image inputs with contextual awareness and world knowledge.
- For this app, prompt creation does not receive the image files. The execution prompt should therefore refer to uploaded reference images as the source of identity and visual consistency without claiming unseen details.
- Multiple reference images may be supplied later to the image API. The execution prompt should say how to use them, not analyze their unseen contents.
- Visible labels, annotations, titles, and callouts requested by the user should be specified as short Japanese text inside the generated image.
- Image prompts should include only material constraints: subject, identity preservation, composition, view layout, style, background, details to show, and things to avoid.

## Safety-sensitive wording

- Avoid wording that can be read as sexualized presentation, erotic posing, fetish styling, or revealing clothing.
- For outfits such as maid, cosplay, uniforms, swimwear-like references, stockings, thigh-high socks, or body-emphasizing costumes, steer toward neutral production terms: modest, non-sexualized, practical, reference-sheet, full-coverage, natural pose, neutral expression, no glamour styling.
- Do not ask for seductive, provocative, sensual, alluring, intimate, boudoir, pin-up, lingerie-like, exposed, skimpy, or body-emphasizing results.
- If the user asks for a costume sheet, emphasize design clarity, garment construction, silhouette, accessories, and neutral stance rather than attractiveness or sex appeal.
