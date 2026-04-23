# ChurchFlow - PRD

## Original Problem Statement
Sistema fullstack completo para gestao de igrejas: gestao de membros, organizacao de cultos (liturgia dinamica), escala de participantes, eleicoes internas, notificacoes e automacoes, suporte multi-igrejas (SaaS-ready), modo culto ao vivo, relatorios, area mobile para participantes. Admin global fixo: iasdstacinterno@gmail.com.

## Architecture
- Backend: FastAPI (Python) + Motor/MongoDB (AsyncIOMotorClient)
- Frontend: React 19 + React Router 7 + Tailwind + Shadcn UI + dnd-kit + recharts + sonner
- Auth: JWT email/senha + Emergent Google Auth (coexistem). httpOnly cookie para sessao Google, Bearer token para JWT
- Emails: Resend (prod ready com API key)
- Google Calendar: MOCKED (apenas log)

## Stack
- Python deps: fastapi, motor, pymongo, pyjwt, bcrypt, resend, httpx, pandas
- Node deps: @dnd-kit/*, recharts, sonner, lucide-react, shadcn ui

## Implemented (2026-04-23)
- [x] Admin seed automatico (iasdstacinterno@gmail.com / Admin@2026 / ADMIN_GLOBAL)
- [x] Seed demo: 1 igreja "IASD Central", 6 membros com cargos variados, 1 template 6-steps
- [x] Auth: register, login, me, logout, Emergent session
- [x] Churches CRUD (admin)
- [x] Members CRUD com cargos multiplos
- [x] Service Templates CRUD + clone
- [x] Services (cultos) CRUD + steps reordenaveis
- [x] Assignments com status (pendente/confirmado/recusado)
- [x] Escala inteligente: /services/{id}/suggest (baseada em cargo + historico recente)
- [x] Eleicoes com voto unico por usuario + resultados em tempo real
- [x] Notificacoes internas (gerada ao criar atribuicao) + email via Resend
- [x] Relatorios: participacao por membro, frequencia por cargo, graficos, CSV export
- [x] Modo Culto ao Vivo: fullscreen timer, etapa atual, proximas etapas
- [x] Editor de liturgia com drag-and-drop (dnd-kit)
- [x] Area mobile participante /app (Tarefas/Cultos/Avisos, confirmar presenca)
- [x] RBAC: ADMIN_GLOBAL, GERENTE_IGREJA, PARTICIPANTE

## Test Results (iteration_1)
- Backend: 16/16 pytest tests PASS
- Frontend: 100% flows passed (login, dashboard, igrejas, membros, cultos, editor, escalas, eleicoes, relatorios, participant)
- Fix applied by testing agent: _id exclusion em /api/auth/register response

## Backlog (P1)
- Google Calendar integracao real (remover mock)
- Envio de lembretes agendados (2 dias antes / 1h antes) - usar scheduler
- Verificar dominio no Resend para enviar para qualquer email
- Eleicoes: encerramento automatico por data
- Historico de participacao detalhado (date-level)
- Pagina de configuracoes de igreja

## Backlog (P2)
- Split server.py em routers/ (>700 linhas)
- Refresh token flow para JWT
- Upload de foto de membro (object storage)
- Multi-idioma (i18n)
- PWA offline mode para area participante
- Integracao YouTube/live streaming
- Domain verification Resend + template design
