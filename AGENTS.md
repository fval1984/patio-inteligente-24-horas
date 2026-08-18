# Instruções para agentes (Cursor)

Este arquivo descreve preferências estáveis do repositório. Siga-as em toda alteração de código.

Idioma das respostas ao utilizador: **português**.

## Cursor Cloud specific instructions

### Git e GitHub Desktop

O fluxo de publicação para `main` é feito **pelo Fernando no GitHub Desktop**, não pelo agente.

Sempre que houver modificação no código:

1. Trabalhe numa **feature branch** (não em `main`).
2. **Commit** com mensagem descritiva.
3. Faça **`git push` da feature branch** para `origin` (obrigatório). Sem o push, o GitHub Desktop não vê os commits desta VM.
4. Abra ou atualize o pull request da branch.

O Fernando, no GitHub Desktop:

1. Faz **Fetch origin**.
2. Revisa os commits.
3. **Ele** publica / faz merge para `main`.

O agente **não** faz merge para `main`, **não** envia commits para `main`, **não** ativa auto-merge e **não** marca o PR como pronto para review a menos que o Fernando peça.

Produção na Vercel segue o `main`. Testar no **preview** da branch + **Ctrl+F5**. Não mesclar até o Fernando pedir.

### Isolamento de módulos

Não misture alterações de módulos diferentes na mesma branch (ex.: vistoria e financeiro). Uma mudança exclusiva de um módulo permanece só nesse módulo: não alterar pátio, cadastro, fotos, dashboard operacional, usuários, permissões ou dados existentes sem pedido explícito.

### Branches

Nomes de branch: `cursor/<nome-descritivo>-cca8` (minúsculas). Base padrão: `main`.
