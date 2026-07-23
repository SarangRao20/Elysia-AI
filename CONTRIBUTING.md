# Contributing to ELYSIA

Thanks for your interest! This is a personal project by **Sarang (SarangRao20)**, but contributions and suggestions are welcome.

## How to Contribute

1. **Fork** the repo
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes
4. Run the checks:
   ```bash
   npm run typecheck   # TypeScript type checking
   source venv/bin/activate && python3 -c "from agent.registry import load_all; load_all(); print('Python OK')"
   ```
5. Commit with a clear message
6. Push and open a Pull Request

## Code Style

- **TypeScript**: Prettier default formatting, no unused variables, strict mode
- **Python**: PEP 8, 4-space indentation
- No commented-out code or `console.log`/`print` debug stubs
- Async for all I/O-bound Python tools

## Pull Request Checklist

- [ ] TypeScript builds clean (`npx tsc --noEmit`)
- [ ] Python imports load clean
- [ ] No hardcoded secrets or API keys
- [ ] If adding a tool: register in `agent/registry.py` and add declaration in `server.ts`

## Reporting Issues

Open an issue at [github.com/SarangRao20/Elysia-AI/issues](https://github.com/SarangRao20/Elysia-AI/issues) with:
- What you were doing
- What happened vs what you expected
- Relevant logs (check browser console + `agent/server.py` output)
