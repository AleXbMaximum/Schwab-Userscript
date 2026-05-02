// Tool schemas appended to analysts that support tool-calling.

export const TOOL_SCHEMA_FUNDAMENTALS = `
## Tool Access
You may make UP TO 3 tool calls total. Stop as soon as any core financial statement returns data, or once all three are confirmed empty.

Priority order (call in this sequence if needed):
<tool_call>{"name": "get_barrons_ratings"}</tool_call>
<tool_call>{"name": "get_barrons_financials"}</tool_call>

If Barron's data is present in your context (sections prefixed with "BARRON'S"), treat it as a higher-confidence data source than Yahoo Finance for analyst consensus and financial ratios.
If a tool returns empty or no data: output a compact DATA_UNAVAILABLE block for that section and stop requesting that data type. Do NOT write narrative for missing data.`;

export const TOOL_SCHEMA_FINANCIAL_QUALITY = `
## Tool Access
You may make UP TO 3 tool calls total. Priority order:

<tool_call>{"name": "get_cash_flow"}</tool_call>
<tool_call>{"name": "get_balance_sheet"}</tool_call>
<tool_call>{"name": "get_income_statement"}</tool_call>
<tool_call>{"name": "get_insider_transactions"}</tool_call>
<tool_call>{"name": "get_barrons_financials"}</tool_call>

If a tool returns empty or no data: output a compact DATA_UNAVAILABLE block for that section.`;

export const TOOL_SCHEMA_SENTIMENT_COMPANY = `
## Tool Access
If you need additional premium news, you may request Barron's news by appending a single tool call:

<tool_call>{"name": "get_barrons_news"}</tool_call>

NOTE ON SOURCE QUALITY: Barron's, Dow Jones Network, and Wall Street Journal are premium tier sources (high weight). If Barron's news is available, it should receive HIGHER weight than generic news aggregators.
If a tool returns empty or no data: output a compact DATA_UNAVAILABLE block; do NOT invent sentiment based on absent data.`;

export const TOOL_SCHEMA_SENTIMENT_MACRO = `
## Tool Access
If you need additional macro context, you may request ONE dataset:

<tool_call>{"name": "get_global_macro_news"}</tool_call>

If a tool returns empty or no data: output a compact DATA_UNAVAILABLE block; do NOT invent sentiment based on absent data.`;

export const TOOL_SCHEMA_SELLSIDE = `
## Tool Access
If Barron's estimate data is not present in your context, you may request it:

<tool_call>{"name": "get_barrons_ratings"}</tool_call>

If a tool returns empty or no data: output a compact DATA_UNAVAILABLE block.`;

export const TOOL_SCHEMA_OWNERSHIP = `
## Tool Access
If Barron's ownership data is not present in your context, you may request it:

<tool_call>{"name": "get_barrons_ratings"}</tool_call>

If a tool returns empty or no data: output a compact DATA_UNAVAILABLE block.`;

export const TOOL_SCHEMA_DEBATER = `
## Tool Access
If specific data would materially strengthen your argument, append ONE tool call at the very end:

<tool_call>{"name": "get_balance_sheet"}</tool_call>
<tool_call>{"name": "get_cash_flow"}</tool_call>
<tool_call>{"name": "get_income_statement"}</tool_call>
<tool_call>{"name": "get_insider_transactions"}</tool_call>
<tool_call>{"name": "get_global_macro_news"}</tool_call>
<tool_call>{"name": "get_barrons_news"}</tool_call>
<tool_call>{"name": "get_barrons_ratings"}</tool_call>`;
