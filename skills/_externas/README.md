# skills/_externas — fora do núcleo

Skills importadas (Anthropic, comunidade) ou utilitários genéricos que **não participam do
fluxo da peça**: nenhuma é chamada pelo `legal-orchestrator`, pelo `md2docx` ou pelos hooks.
Movidas para cá em 02/10/2026 para que `SKILLS.md` e o `lint-skills` listem só o motor.

- Não são descobertas automaticamente (`skills/*/SKILL.md` não desce aqui). Para usar uma,
  aponte o caminho completo: `skills/_externas/<nome>/SKILL.md`.
- Para devolver uma ao núcleo: `git mv skills/_externas/<nome> skills/<nome>` e
  `npm run registro`.
- As que estão no `.gitignore` (pdf, xlsx, Scrapling-Skill, smart-browser-orchestrator,
  vulnerability-scanner, documentation-templates, skill-mcp-creator, audio-converter) só
  existem na máquina da titular, como antes.
