# 📋 Roadmap & Acompanhamento de Evolução do Projeto

Este documento reúne o planejamento estratégico, novas funcionalidades propostas, melhorias técnicas e o status de implementação para a plataforma de gestão financeira dos motoristas de aplicativo.

---

## 🎯 Status Geral do Projeto

- [x] Correção do cálculo de custo fixo diário por mês selecionado
- [x] Filtro de vencimento de despesas fixas (Agosto / Setembro)
- [x] Sincronização de rotina de trabalho com cálculo de metas

---

## 🚀 Novas Funcionalidades (Backlog & Propostas)

### 1. Métricas de Eficiência Operacional (R$/km e R$/hora)
- [x] **Indicadores no Dashboard:** Exibir rendimento real por km e por hora trabalhada.
- [x] **Comparador de Eficiência:** Comparar o rendimento real com a meta/hora estipulada na rotina.
- [x] **Badge de Rentabilidade:** Alertas visuais (Ex: *Excelente*, *Na Média*, *Abaixo do Ideal*).

### 2. Lançamento Rápido no Fim de Turno
- [x] **Ação Rápida no Dashboard:** Modal/Card na tela inicial para registrar o dia atual em 3 campos rápidos:
  - Faturamento Bruto (R$)
  - KM Rodados
  - Horas Trabalhadas
- [x] **Sugestão Inteligente:** Preencher automaticamente horas com base na rotina padrão cadastrada.
- [x] **Sincronização Imediata:** Atualização em tempo real das metas e cartões do Dashboard ao salvar.

### 3. Calculadora de Abastecimento & Consumo de Combustível
- [ ] **Registro de Litros e Odômetro:** Campos opcionais no lançamento de despesa de combustível.
- [ ] **Cálculo de Consumo Médio:** Apuração de `km/l` e custo de combustível por km rodado (`R$/km`).
- [ ] **Comparador Etanol x Gasolina:** Simulador da regra dos 70% com preços locais.

### 4. Simulador de Folgas e Férias Remuneradas
- [ ] **Provisão de 13º e Descanso:** Cálculo de taxa mensal para reserva de férias/folgas.
- [ ] **Recálculo Automático das Metas Diárias:** Ajustar meta por dia trabalhado considerando os dias de descanso planejados.

### 5. Exportação e Fechamento Mensal
- [ ] **Resumo para Impressão/PDF:** Relatório consolidado de faturamento, custos fixos pagos, despesas variáveis e lucro líquido.
- [ ] **Compartilhamento / WhatsApp:** Formato de texto limpo para envio de resumo do mês.
- [ ] **Exportação para CSV/Excel:** Download de lançamentos detalhados do mês.

---

## 🛠️ Melhorias Técnicas e de UX

### Experiência do Usuário (UI/UX & Mobile)
- [ ] **Celebração de Meta Batida:** Feedback visual e animação quando o faturamento do dia/mês atingir 100% da meta.
- [ ] **Toasts Globais de Notificação:** Avisos claros de sucesso e erro ao salvar registros em conexões instáveis.
- [ ] **Validação de Formulários:** Impedir entradas acidentais de valores negativos ou formatações inválidas.

### Performance & Código
- [ ] **Otimização de Carregamento:** Memoização de chamadas de API ao alternar abas dentro do mesmo mês.
- [ ] **Padronização de Tratamento de Erros:** Interceptor centralizado no cliente HTTP para capturar quedas de rede de forma amigável.

---

## 📌 Prioridades de Execução (Próximos Passos)

| Prioridade | Tarefa | Impacto | Esforço | Status |
|---|---|---|---|---|
| **1** | Lançamento Rápido no Dashboard | Alto (reduz atrito diário do motorista) | Baixo | 🟢 Concluído |
| **2** | Métricas de Eficiência (R$/km e R$/h) | Alto (clareza sobre rentabilidade real) | Médio | 🟢 Concluído |
| **3** | Relatório / Fechamento Mensal em PDF | Médio (auxilia no controle e IRPF) | Médio | ⚪ Planejado |

---
*Última atualização: 28 de Agosto de 2026*
