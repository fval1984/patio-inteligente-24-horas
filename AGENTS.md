# Instruções para agentes (Cursor)

Idioma das respostas ao utilizador: **português**.

## GitHub Desktop — fluxo obrigatório (como era)

O Fernando trabalha no **GitHub Desktop**, na aba **Changes / Changed files**:

1. Vê os arquivos modificados.
2. Marca os que entram no commit.
3. Faz o **commit**.
4. Faz **Push origin** para `main`.

A branch principal é **`main`**. Não usar `master`.

### O agente NÃO deve

- `git add`, `git commit` ou `git push`
- criar branch `cursor/...` (nem outra feature branch)
- abrir pull request
- fazer merge para `main`

O agente só altera os arquivos no disco e **deixa o working tree sujo**. Quem commita e envia para o GitHub é o Fernando, no GitHub Desktop.

Este fluxo só funciona no **Cursor do computador**, na mesma pasta que o GitHub Desktop abre. Agente na nuvem grava noutra máquina e **não aparece** em Changed files.

### Isolamento de módulos

Não misturar vistoria, financeiro e outros módulos na mesma alteração, salvo pedido explícito.
