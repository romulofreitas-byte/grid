# GRID — Estudo de marca
### Símbolo, sistema e regras de aplicação · sub-marca do Mundo Pódium
**17/08/2026**

---

## 1. O PROBLEMA A RESOLVER

O GRID precisa de uma identidade que resolva três coisas ao mesmo tempo, e elas puxam em direções opostas:

1. **Pertencer.** Quem vê o GRID tem que reconhecer que é da mesma casa que o Mundo Pódium.
2. **Não competir.** Se as duas marcas brigam pela mesma leitura, a audiência não entende o que é escola e o que é ferramenta.
3. **Funcionar em ambiente de software.** A marca-mãe vive em capa de YouTube e slide. O GRID vive em favicon de 16px, aba do navegador, ícone de app e canto de sidebar.

A saída não é desenhar do zero nem variar a cor da marca-mãe. É **herdar a gramática geométrica e trocar a ideia.**

---

## 2. O QUE FOI HERDADO E O QUE FOI TROCADO

### Herdado (o DNA)

| Elemento | Valor |
|---|---|
| Unidade de forma | Paralelogramo reto com topo deslocado |
| **Inclinação** | **10,2°** — medida diretamente das barras da marca-mãe, não aproximada |
| Largura do módulo | 26 unidades — a mesma barra |
| Regra de cor | Amarelo Pódium exclusivo do elemento de destaque, nunca decorativo |
| Tipografia | Sora, mesma família e mesmos pesos |
| Fundo | Navy `#0B1A2E`, o padrão da ferramenta |

A inclinação é o detalhe que faz o parentesco funcionar mesmo quando ninguém consegue explicar por quê. Os dois símbolos "correm" no mesmo ângulo.

### Trocado (a ideia)

| | Mundo Pódium | GRID |
|---|---|---|
| **Motivo** | Escada ascendente | Campo escalonado de largada |
| **Composição** | Uma fileira, alturas crescentes | Três fileiras, alturas iguais, escalonadas |
| **Silhueta** | Cunha diagonal maciça | Campo quadriculado disperso |
| **Momento da corrida** | A chegada | A largada |
| **Posição do amarelo** | Topo à direita — o degrau mais alto | **Frente à esquerda — o P1, o primeiro a ligar** |
| **Leitura** | "Você subiu" | "É por aqui que se começa" |

**O amarelo viaja de lado.** Na marca-mãe ele está no fim da subida, no ponto mais alto. No GRID ele está na linha de largada, na frente. Mesma cor, mesma regra, papel invertido — e isso conta a relação entre os dois produtos sem precisar de uma palavra.

### O achado do processo

O símbolo do GRID lê como **duas coisas ao mesmo tempo**: um grid de largada visto de cima, e um fragmento de bandeira quadriculada.

Isso não foi planejado — apareceu no primeiro teste e foi mantido. E tem uma justificativa de sistema: a marca-mãe já usa quadriculado, mas como **detalhe** — os quadradinhos vazados no topo da barra amarela. O GRID pega esse detalhe e **promove ele a protagonista**.

É exatamente assim que uma sub-marca deve derivar: herda um detalhe da mãe e transforma ele no assunto principal. O parentesco fica evidente sem ser cópia.

---

## 3. OS CONCEITOS DESCARTADOS

Cinco caminhos foram desenhados e testados. Por que os outros quatro caíram:

**B · Fila** — quatro slots em linha reta, o da frente amarelo. Some no pequeno: o quadriculado da dianteira desaparece antes dos 32px e o que sobra parece gráfico de barras.

**C · Campo de busca** — malha 4×3 com um quadrado amarelo. Diz "ferramenta de dados", mas serve para qualquer software do mundo. Silhueta virou mancha.

**D · Chevron** — três setas apontando pra frente. Genérico. Toda transportadora e toda startup de logística tem uma variação disso. E não comunica lista nem ordenação.

**E · Slot P1** — bloco amarelo grande com quadriculado. Bonito no grande, mas o amarelo ocupando quase toda a área quebra a regra de accent da marca — vira decorativo por peso.

**A4 · Amarelo no topo** — mesma malha do vencedor, mas com o amarelo na fileira de trás. Descartado por conflito semântico: amarelo no alto é o território do Mundo Pódium. No GRID ele tem que estar na frente, porque significa outra coisa.

---

## 4. O SÍMBOLO ESCOLHIDO

Seis paralelogramos de 26 × 30, dispostos em 3 fileiras × 2 colunas, cada fileira escalonada meia coluna para a direita. O slot da frente à esquerda em Amarelo Pódium; os outros cinco em branco.

### Geometria exata

Espaço de coordenadas com base em y = 200, inclinação de 10,2° (deslocamento horizontal = 0,18 × altura):

```
P1 (amarelo)   (0.0,200.0)   (26.0,200.0)   (31.4,170.0)   (5.4,170.0)
fileira 0 · 2  (40.0,200.0)  (66.0,200.0)   (71.4,170.0)   (45.4,170.0)
fileira 1 · 1  (26.8,162.0)  (52.8,162.0)   (58.2,132.0)   (32.2,132.0)
fileira 1 · 2  (66.8,162.0)  (92.8,162.0)   (98.2,132.0)   (72.2,132.0)
fileira 2 · 1  (53.7,124.0)  (79.7,124.0)   (85.1,94.0)    (59.1,94.0)
fileira 2 · 2  (93.7,124.0)  (119.7,124.0)  (125.1,94.0)   (99.1,94.0)
```

Módulo 26 × 30 · vão vertical 8 · vão horizontal 14 · escalonamento de meia coluna (20) por fileira.

**Área de respiro:** a largura de um slot (26 unidades) em volta de toda a marca. Nada entra aí.

---

## 5. TAMANHO MÍNIMO

| Tamanho | Comportamento |
|---|---|
| 96 – 48px | Leitura completa. Escalonamento e quadriculado nítidos |
| 32px | Ainda íntegro. É o tamanho de aba de navegador |
| **20px** | **Mínimo recomendado da versão de 6 slots** |
| 16px e abaixo | Use a **versão favicon de 4 slots (2×2)**, incluída no kit |

O escalonamento morre antes do slot. Por isso a versão reduzida corta a terceira fileira em vez de encolher tudo. O amarelo do P1 é o que ancora a leitura no pequeno — nunca gere uma versão monocromática para favicon.

---

## 6. VERSÕES DE COR

| Versão | Uso |
|---|---|
| **Principal** — branco + P1 amarelo | Sobre navy ou preto. É a versão padrão do app |
| **Fundo claro** — navy + P1 amarelo | Documento, planilha exportada, PDF, contrato |
| **Mono branco** | Vídeo, marca d'água, aplicação sobre foto |
| **Mono navy** | Impressão a uma cor |
| **Mono amarelo** | Selo, brinde, gravação a laser |

Nas versões monocromáticas o P1 perde o destaque — é aceitável, porque nesses contextos a leitura vem da silhueta. **Não invente uma sexta versão** com o P1 em outra cor.

---

## 7. ASSINATURAS

### Arquitetura de marca: endosso, não subordinação

`GRID` é a marca. `MUNDO PÓDIUM` endossa embaixo, em corpo pequeno, peso SemiBold, tracking largo, em cinza — **nunca em amarelo**, porque endosso não é destaque.

Isso é deliberado. O GRID pode ser vendido fora do ecossistema da escola, para quem nunca ouviu falar do Mundo Pódium. A marca precisa aguentar ficar de pé sozinha.

| Assinatura | Quando usar |
|---|---|
| **Horizontal com endosso** | Padrão. Site, header do app, apresentação, página de vendas |
| **Horizontal sem endosso** | Dentro do app, onde o contexto já é conhecido |
| **Vertical** | Espaço estreito, avatar, capa quadrada |
| **Símbolo isolado** | Favicon, ícone de app, sidebar recolhida, marca d'água |

**Proporção:** o símbolo tem a altura do bloco de texto inteiro (GRID + endosso), alinhado ao centro vertical desse bloco. É a mesma regra de lockup da marca-mãe.

**Não escreva "GRID Pódium" como palavra composta.** Ou é `GRID` com o endosso embaixo, ou é `GRID` sozinho. "Grid Pódium" corrido cria um terceiro nome que não existe em lugar nenhum do produto.

---

## 8. REGRAS DE APLICAÇÃO

**Faça:**
- Use a versão de 6 slots acima de 20px e a de 4 slots abaixo disso
- Mantenha o respiro de um slot em volta
- Amarelo só no P1
- Em fundo escuro, sempre a versão principal

**Não faça:**
- Não gire, não espelhe, não mude a inclinação
- Não recolora os slots brancos
- Não coloque contorno, sombra, gradiente ou brilho
- Não coloque o símbolo do Mundo Pódium ao lado do símbolo do GRID — dois símbolos juntos confundem. Se precisar mostrar a relação, use o endosso tipográfico
- Não use a marca do GRID em material da escola nem a do Mundo Pódium dentro do app
- Não anime o símbolo montando slot por slot como se fosse loading. A tentação vai existir; o resultado parece skeleton de carregamento quebrado

---

## 9. O QUE FICA EM ABERTO

1. **Validação em uso real.** Coloque o favicon no navegador e o ícone no celular por uma semana antes de fechar. Marca de software se prova na aba, não em folha de apresentação.
2. **Registro.** "GRID" sozinho é palavra genérica e provavelmente não registrável como marca nominativa isolada em software. O registro viável é do **conjunto figurativo** (símbolo + tipografia) ou de `GRID PÓDIUM`. Vale conversar com um advogado de propriedade industrial antes de investir em material impresso.
3. **Ícone de app na App Store / Play**, se um dia houver aplicativo nativo — as duas exigem grade própria e o símbolo vai precisar de ajuste ótico de margem.

---

## 10. O QUE ESTÁ NO KIT

```
kit/
├── svg/      grid_dark · grid_light · grid_mono_w · grid_mono_n
│             grid_gold · grid_favicon · grid_favicon_light
├── png/      cada versão em 1024, 512, 256, 128, 64, 32
│             favicons em 64, 32, 16
├── lockup/   horizontal com endosso · horizontal solo · vertical · fundo claro
└── geometria.txt   coordenadas exatas dos seis slots
```

Os SVGs são vetor puro, sem texto convertido e sem dependência de fonte — abrem em qualquer editor e escalam sem perda.
