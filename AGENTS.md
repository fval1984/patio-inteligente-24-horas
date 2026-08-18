# Instruções para agentes (Cursor)

Idioma das respostas ao utilizador: **português**.

## Git — como o Fernando usa (obrigatório)

A branch é **`main`**. Nunca usar `master`. Não criar branch `cursor/...` nem pull request, salvo pedido explícito.

### Cursor no computador (GitHub Desktop)

O Fernando commita na aba **Changes / Changed files**: marca os arquivos, commit, **Push origin**.

Nesse caso o agente **não** faz `git commit` nem `git push`. Só altera os arquivos no disco.

### Agente na nuvem

Não consegue colocar arquivo na aba Changes do PC. Quando o Fernando pedir para resolver daqui / deixar como antes:

1. Trabalhar em **`main`**.
2. Commit.
3. `git push origin main`.

No GitHub Desktop ele só faz **Fetch origin** e **Pull origin**. Não pedir Command Prompt nem SSH.

### Isolamento de módulos

Não misturar vistoria, financeiro e outros módulos na mesma alteração, salvo pedido explícito.
