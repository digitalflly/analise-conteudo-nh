# Análise de Conteúdo — Instagram (Windsor.ai)

Dashboard de performance do Instagram da **Nathalia Heringer**, com dados reais
servidos pela [Windsor.ai](https://windsor.ai). O botão **Atualizar** (ícone de
recarregar no topo) puxa os dados mais recentes ao vivo — sem precisar editar
código.

## Como funciona

| Camada | Arquivo | Papel |
| --- | --- | --- |
| Front-end | `Dashboard.html` + `dashboard-*.js` | App em React (via CDN local em `lib/`). Renderiza KPIs, gráficos e tabelas. |
| Dados (offline) | `dashboard-data.js` | Contém um *seed* embutido (último sync) e o construtor `buildDashboardData()`. O app abre instantâneo, mesmo sem internet. |
| Atualização | `dashboard-refresh.js` | Ao clicar em **Atualizar**, busca `/api/refresh`, reconstrói o modelo e re-renderiza. |
| Back-end | `api/refresh.js` | Função serverless do Vercel. Chama a Windsor.ai com a sua chave (guardada no servidor) e normaliza os dados. |

O fluxo do botão **Atualizar**:

```
Botão → /api/refresh (Vercel) → Windsor.ai → normaliza → rebuild → re-render
```

A chave da Windsor **nunca** vai para o navegador: ela fica na variável de
ambiente `WINDSOR_API_KEY`, lida apenas pela função serverless.

## Subir no GitHub + Vercel

1. **Crie o repositório** e suba estes arquivos:
   ```bash
   git init
   git add .
   git commit -m "Dashboard de análise de conteúdo"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/SEU_REPO.git
   git push -u origin main
   ```

2. **Importe no Vercel**: em [vercel.com/new](https://vercel.com/new), selecione o
   repositório. Não há build step — é um site estático com uma função em `api/`.
   O Vercel detecta tudo automaticamente.

3. **Configure as variáveis de ambiente** (Project → Settings → Environment
   Variables):

   | Nome | Valor | Obrigatório |
   | --- | --- | --- |
   | `WINDSOR_API_KEY` | sua chave da Windsor.ai | ✅ |
   | `WINDSOR_IG_ACCOUNT_ID` | `17841401155274275` (conta da Nathalia) | recomendado |
   | `WINDSOR_DAYS` | `200` (janela de histórico) | opcional |
   | `WINDSOR_DATE_FROM` | `2026-01-01` (data inicial fixa) | opcional |

   > Onde achar a chave: [onboard.windsor.ai](https://onboard.windsor.ai) →
   > **Settings → API key**. Use a mesma conta onde o Instagram da Nathalia está
   > conectado.

4. **Deploy.** Pronto — abra a URL e clique em **Atualizar** para puxar os dados
   ao vivo.

## Solução de problemas — botão "Atualizar" não funciona no Vercel

O passo mais rápido para descobrir a causa: **abra a função direto no navegador**
em modo diagnóstico (não dispara erro, só relata o estado):

```
https://SEU-APP.vercel.app/api/refresh?diag=1
```

O JSON retornado mostra a versão do Node, se o `fetch` existe, se a
`WINDSOR_API_KEY` está setada, e quais sub-consultas à Windsor passaram/falharam.
Com isso dá pra identificar exatamente o problema:

| Sintoma no `?diag=1` | Causa | Correção |
| --- | --- | --- |
| `"error": "WINDSOR_API_KEY não configurada..."` | variável de ambiente ausente | adicione `WINDSOR_API_KEY` em Settings → Environment Variables (ambiente **Production**) e **refaça o deploy** (variáveis só valem em deploys novos) |
| `"fetchAvailable": false` | runtime Node antigo (< 18) | o `package.json` já fixa `"node": "20.x"`; confirme em Settings → General → Node.js Version = 20.x e refaça o deploy |
| `queries` com `"ok": false` e erro `401`/`403` | chave inválida ou sem acesso ao IG | gere a chave em [onboard.windsor.ai](https://onboard.windsor.ai) na conta que tem o Instagram conectado |
| `queries` com `"ok": false` e erro de timeout | consulta longa demais | reduza `WINDSOR_DAYS` (ex.: `120`) — note que isso encurta o histórico |
| página `/api/refresh` dá **404** | função não publicada | confirme que o arquivo está em `api/refresh.js` na raiz do repo e que o deploy é do branch certo |

Pontos importantes:

- **Variáveis de ambiente só entram em deploys feitos *depois* de criá-las.** Se
  você adicionou a `WINDSOR_API_KEY` depois do primeiro deploy, force um
  *Redeploy* (Deployments → ⋯ → Redeploy).
- A função é **resiliente**: se só a demografia ou a mídia falhar, ela ainda
  devolve os dados diários e o dashboard atualiza (os avisos vêm no campo
  `warnings` da resposta).

## Rodar localmente

```bash
npm i -g vercel        # uma vez
cp .env.example .env   # preencha WINDSOR_API_KEY
vercel dev             # serve o site + a função /api/refresh em localhost
```

Abrir o `Dashboard.html` direto no navegador (sem `vercel dev`) também funciona,
mas o botão **Atualizar** só recarrega o seed — a função `/api/refresh` precisa
do ambiente do Vercel.

## Atualizar o *seed* embutido (opcional)

O seed em `dashboard-data.js` é só um ponto de partida offline. Ele não precisa
ser mexido — o botão **Atualizar** sempre busca dados frescos. Se quiser
"congelar" um novo ponto de partida, basta substituir os arrays do seed pela
resposta de `/api/refresh`.

## Notas

- O histórico de seguidores é reconstruído a partir do saldo diário
  (`follows_and_unfollows`) ancorado no total atual — a Windsor expõe o número
  absoluto de seguidores apenas dos últimos ~30 dias.
- As semanas (ISO) e os meses do seletor são gerados automaticamente a partir do
  intervalo de dados retornado, então qualquer janela de datas funciona.
