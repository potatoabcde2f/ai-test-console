export function PlatformIntroView() {
  return (
    <div className="panel" style={{ flex: 1, padding: "2rem", overflow: "auto" }}>
      {/* 标题区域 */}
      <div style={{ textAlign: "center", marginBottom: "2.5rem", paddingBottom: "2rem", borderBottom: "2px solid var(--accent)" }}>
        <h1 style={{ fontSize: "2rem", marginBottom: "0.75rem", color: "var(--accent)" }}>
          🤖 AI Stylist 测试平台
        </h1>
        <p style={{ fontSize: "1.1rem", color: "var(--text-muted)", maxWidth: 800, margin: "0 auto", lineHeight: 1.6 }}>
          全方位 AI 对话测试与评估系统，支持单轮/多轮对话、批量测试、意图识别评测等功能
        </p>
      </div>

      {/* 功能详解 */}
      <section style={{ marginBottom: "2.5rem" }}>
        <h2 style={{ fontSize: "1.25rem", marginBottom: "1.25rem", color: "var(--text)", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "1.5rem" }}>📋</span> 功能模块详解
        </h2>

        {/* 1. 原始对话测试 */}
        <DocSection
          title="1. 原始对话测试"
          icon="💬"
          desc="可直接在这里模拟测试环境的 AI Stylist 对话测试，显化请求参数和响应数据，白盒化各个节点，支持上传图片和生成图片，支持评测"
          content={[
            { label: "核心功能", text: "模拟测试环境的 AI Stylist 对话测试，显化请求参数和响应数据，白盒化各个节点" },
            { label: "图片支持", text: "支持上传图片和生成图片，保存对话库后对话记录存入【对话结果存储】" },
            { label: "评测功能", text: "支持对对话结果进行人工评测，标注通过/不通过，添加优化建议" },
            { label: "Base URL", text: "保留默认即可，本地开发使用 Vite 代理" },
            { label: "chat_svc", text: "模型选型，可切换，支持 qwen、closet_gpt4o 等，但 gemini 模型可能不太稳定" },
            { label: "uid", text: "可随便填一个（字母或数字都行），置空的话则走默认 uid：b4f79630-5fda-11f1-9a08-cf993e214361" },
            { label: "debug", text: "填入 model_debug 才会显化各个节点，保留即可" },
            { label: "其余 prompt", text: "对应 oms 通用配置处的 prompt，直接填入 prompt 完整内容" },
            { label: "追问提示词", text: "即生成目前测试平台的三个追问问题的 prompt，可修改以获得更好的追问问题效果，这个参数不关联 api，为单独接口" },
          ]}
        />

        {/* 2. 提示词存储 */}
        <DocSection
          title="2. 提示词存储"
          icon="📝"
          desc="可以放各个提示词，类似 oms 后台【通用配置】，但是具体以 oms 后台为准"
          content={[
            { label: "功能说明", text: "存放和管理各类 prompt 提示词模板" },
            { label: "数据来源", text: "类似 oms 后台【通用配置】，但具体以 oms 后台为准" },
          ]}
        />

        {/* 3. 对话结果存储 */}
        <DocSection
          title="3. 对话结果存储"
          icon="📂"
          desc="只有【原始对话测试】保存到对话库的才会出现在这里"
          content={[
            { label: "数据来源", text: "只有【原始对话测试】保存到对话库的才会出现在这里" },
            { label: "查看内容", text: "可查看历史对话记录、白盒数据、评测结果" },
            { label: "导出支持", text: "支持导出对话数据为 JSON 格式" },
          ]}
        />

        {/* 4. 生图结果存储 */}
        <DocSection
          title="4. 生图结果存储"
          icon="🖼️"
          desc="只要【原始对话测试】涉及的生图都会关联到这里"
          content={[
            { label: "数据来源", text: "只要【原始对话测试】涉及的生图都会关联到这里" },
            { label: "查看内容", text: "可查看生成的图片、生图提示词、使用的模型等信息" },
            { label: "历史记录", text: "保存所有生图记录，方便追溯和复用" },
          ]}
        />

        {/* 5. 批量测试 */}
        <DocSection
          title="5. 批量测试"
          icon="⚡"
          desc="支持导入问题库进行批量跑对话测试，支持 Prompt 对比和模型对比两种模式"
          content={[
            { label: "第一步", text: "选择测试模式：🔄 Prompt对比（同一模型，不同Prompt对比）或 🔀 模型对比（同一问题，多个模型对比）" },
            { label: "第二步", text: "配置变量：Prompt对比模式填写Prompt A/B（模型可选）；模型对比模式选择1-3个模型（Prompt配置可选）" },
            { label: "第三步", text: "选择问题：选择问题分类，可勾选 UID数据隔离（每个问题使用不同UID）" },
            { label: "可选配置", text: "Prompt参数配置（折叠）：仅模型对比模式显示，支持自定义各prompt参数" },
            { label: "自动运行", text: "创建后即自动调用接口进行对话" },
            { label: "单模型浏览", text: "支持浏览模式，可逐题查看（上一题/下一题），查看白盒数据和回复内容" },
            { label: "Prompt展示", text: "Prompt对比模式在任务详情页直接展示Prompt A/B完整内容" },
            { label: "评测功能", text: "多模型对比/Prompt对比支持人工评选最优，生成评测报告" },
            { label: "任务列表", text: "显示测试模式标识（🔄Prompt对比/🔀模型对比）、具体模型名、UID隔离标签" },
          ]}
        />

        {/* 6. 意图识别测试 */}
        <DocSection
          title="6. 意图识别测试"
          icon="🎯"
          desc="导入【问题库管理】里面的意图识别相关的问题，然后创建评测集（即人工打标意图分类），创建后评测集可复用"
          content={[
            { label: "数据来源", text: "导入【问题库管理】里面的意图识别相关的问题" },
            { label: "创建评测集", text: "创建评测集（即人工打标意图分类），创建后评测集可复用" },
            { label: "增量导入", text: "如果问题库新增，评测集这里只需要点击导入即可新增问题，继续打标即可" },
            { label: "批量运行", text: "调用评测集跑对话可批量跑" },
            { label: "评测报告", text: "最终展示通过率，可用于调整意图识别提示词" },
            { label: "意图类型", text: "1-生图需求, 2-通用问答, 3-产品介绍, 4-图片推荐" },
          ]}
        />

        {/* 7. 问题库管理 */}
        <DocSection
          title="7. 问题库管理"
          icon="📚"
          desc="即批量测试和意图识别测试需要用到的问题，支持导入和导出 excel"
          content={[
            { label: "功能说明", text: "批量测试（5）和意图识别测试（6）需要用到的问题" },
            { label: "导入导出", text: "支持导入和导出 Excel" },
            { label: "Excel 格式", text: "两列：分类 | 问题" },
            { label: "应用场景", text: "为批量测试提供测试问题来源" },
          ]}
        />
      </section>

      {/* 参数配置说明 */}
      <section style={{ marginBottom: "2.5rem" }}>
        <h2 style={{ fontSize: "1.25rem", marginBottom: "1.25rem", color: "var(--text)", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "1.5rem" }}>⚙️</span> 通用参数配置说明
        </h2>
        <div className="panel" style={{ padding: "1.25rem", background: "var(--bg-subtle)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--border)" }}>
                <th style={{ textAlign: "left", padding: "0.75rem", fontWeight: 600, width: "20%" }}>参数名</th>
                <th style={{ textAlign: "left", padding: "0.75rem", fontWeight: 600, width: "50%" }}>说明</th>
                <th style={{ textAlign: "left", padding: "0.75rem", fontWeight: 600, width: "30%" }}>示例值</th>
              </tr>
            </thead>
            <tbody>
              <ParamRow
                name="Base URL"
                desc="API 服务器地址，本地开发保留默认即可"
                example="http://192.168.15.62:8082"
              />
              <ParamRow
                name="chat_svc"
                desc="模型选型，支持 qwen、closet_gpt4o 等，gemini 可能不太稳定"
                example="closet_gpt54mini"
              />
              <ParamRow
                name="uid"
                desc="用户ID，可随便填（字母或数字），置空走默认 uid"
                example="aB3dE7kL9m"
              />
              <ParamRow
                name="debug"
                desc="填入 model_debug 显化各个节点"
                example="model_debug"
              />
              <ParamRow
                name="prompt_closet_chat_detect"
                desc="意图识别，判断用户input走哪个分支（1-生图, 2-问答, 3-产品介绍, 4-图片推荐）"
                example="你是意图识别助手..."
              />
              <ParamRow
                name="prompt_img_extract_system"
                desc="生图提示词撰写，用户有生图需求时调用此prompt写生图提示词，走1分支时调用"
                example="你是生图提示词撰写专家..."
              />
              <ParamRow
                name="prompt_closet_chat"
                desc="穿搭顾问对话，用户输入文字内容时调用的提示词，走2分支时调用"
                example="你是穿搭顾问..."
              />
              <ParamRow
                name="prompt_closet_chat_image"
                desc="图片穿搭顾问，用户输入图片内容时调用的提示词，走2分支时调用"
                example="分析图片穿搭..."
              />
              <ParamRow
                name="prompt_closet_chat_product"
                desc="产品介绍，用户提及Dlook相关功能时调用的提示词，走3分支时调用"
                example="介绍Dlook产品..."
              />
              <ParamRow
                name="prompt_closet_trend_filter"
                desc="穿搭意图解析器，返回用户需要的穿搭图相关维度json，协助穿搭图库检索，走4分支时调用"
                example="解析穿搭意图..."
              />
              <ParamRow
                name="prompt_closet_chat_sum"
                desc="会话标题生成，每个session的对话标题总结，根据用户input提取短语"
                example="生成会话标题..."
              />
              <ParamRow
                name="追问提示词"
                desc="生成追问问题，不关联 API 为单独接口"
                example="根据对话生成3个追问..."
              />
            </tbody>
          </table>
        </div>
      </section>

      {/* 数据流转说明 */}
      <section style={{ marginBottom: "2.5rem" }}>
        <h2 style={{ fontSize: "1.25rem", marginBottom: "1.25rem", color: "var(--text)", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "1.5rem" }}>🔄</span> 数据流转关系
        </h2>
        <div className="panel" style={{ padding: "1.25rem", background: "var(--bg-subtle)", border: "1px solid var(--border)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <DataFlowItem
              from="原始对话测试"
              to="对话结果存储"
              desc="保存到对话库的会出现在这里"
            />
            <DataFlowItem
              from="原始对话测试"
              to="生图结果存储"
              desc="涉及的生图都会关联到这里"
            />
            <DataFlowItem
              from="问题库管理"
              to="批量测试"
              desc="提供测试问题来源"
            />
            <DataFlowItem
              from="问题库管理"
              to="意图识别测试"
              desc="导入意图识别相关问题"
            />
            <DataFlowItem
              from="提示词存储"
              to="原始对话测试 / 批量测试"
              desc="提供 prompt 配置参考"
            />
          </div>
        </div>
      </section>

      {/* 快速开始 */}
      <section style={{ marginBottom: "2.5rem" }}>
        <h2 style={{ fontSize: "1.25rem", marginBottom: "1.25rem", color: "var(--text)", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "1.5rem" }}>🚀</span> 快速开始
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <StepCard
            number={1}
            title="配置 API 参数"
            desc="在【原始对话测试】点击「显示配置」，设置 Base URL、chat_svc 模型等基础参数"
          />
          <StepCard
            number={2}
            title="准备问题库"
            desc="在【问题库管理】导入或添加测试问题，按分类管理，支持 Excel 导入导出"
          />
          <StepCard
            number={3}
            title="进行对话测试"
            desc="在【原始对话测试】输入问题，查看 AI 回复和白盒数据，可上传图片进行多模态测试"
          />
          <StepCard
            number={4}
            title="批量跑测"
            desc="在【批量测试】创建任务：①选择测试模式 ②配置变量 ③选择问题，支持Prompt对比和模型对比两种模式"
          />
          <StepCard
            number={5}
            title="查看结果"
            desc="单模型模式支持浏览模式逐题查看；Prompt对比/模型对比模式支持人工评测，查看评测报告"
          />
          <StepCard
            number={6}
            title="意图评测"
            desc="在【意图识别测试】创建评测集，人工标注意图类型，运行评测查看通过率"
          />
        </div>
      </section>

      {/* 注意事项 */}
      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.25rem", marginBottom: "1rem", color: "var(--text)", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "1.5rem" }}>⚠️</span> 注意事项
        </h2>
        <div style={{ background: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 8, padding: "1rem", color: "#92400e" }}>
          <ul style={{ margin: 0, paddingLeft: "1.25rem", lineHeight: 1.8 }}>
            <li>本地开发使用 <code>npm run dev</code>，会自动使用 Vite 代理转发 API 请求</li>
            <li>生产环境部署时，需要将 API 服务器配置为 HTTPS，否则浏览器会阻止混合内容</li>
            <li>uid 参数通过 HTTP Header 发送，不在请求 body 中</li>
            <li>批量测试的模型选择变为可选，未选择时使用默认模型</li>
            <li>UID数据隔离勾选后，每个问题会生成独立的10位随机UID</li>
            <li>单模型测试支持浏览模式，可逐题查看上一题/下一题</li>
            <li>Prompt对比模式在任务详情页可直接查看Prompt A/B完整内容</li>
            <li>数据保存在浏览器 localStorage，清除浏览器数据会丢失测试记录</li>
            <li>提示词存储功能类似 oms 后台【通用配置】，但具体以 oms 后台为准</li>
            <li>gemini 模型可能不太稳定，建议优先使用 qwen 或 gpt 系列模型</li>
          </ul>
        </div>
      </section>

      {/* 底部 */}
      <div style={{ textAlign: "center", paddingTop: "2rem", borderTop: "1px solid var(--border)", color: "var(--text-muted)", fontSize: "0.85rem" }}>
        <p>AI Stylist 测试平台 · 为 AI 对话质量保驾护航</p>
        <p style={{ marginTop: "0.5rem" }}>有问题请联系开发团队</p>
      </div>
    </div>
  );
}

// 功能区块组件
function DocSection({ title, icon, desc, content }: { title: string; icon: string; desc: string; content: { label: string; text: string }[] }) {
  return (
    <div
      className="panel"
      style={{
        marginBottom: "1.25rem",
        padding: "1.25rem",
        borderLeft: "3px solid var(--accent)",
      }}
    >
      <h3 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: 8 }}>
        <span>{icon}</span> {title}
      </h3>
      <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", marginBottom: "1rem", lineHeight: 1.5 }}>{desc}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
        {content.map((item, idx) => (
          <div key={idx} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "var(--accent)",
                background: "var(--accent-soft)",
                padding: "2px 8px",
                borderRadius: 4,
                whiteSpace: "nowrap",
                marginTop: "1px",
                minWidth: 100,
              }}
            >
              {item.label}
            </span>
            <span style={{ fontSize: "0.9rem", color: "var(--text)", lineHeight: 1.5, flex: 1 }}>{item.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// 参数表格行组件
function ParamRow({ name, desc, example }: { name: string; desc: string; example: string }) {
  return (
    <tr style={{ borderBottom: "1px solid var(--border)" }}>
      <td style={{ padding: "0.75rem", fontFamily: "var(--font-mono)", fontSize: "0.85rem", color: "var(--accent)" }}>
        <code>{name}</code>
      </td>
      <td style={{ padding: "0.75rem", color: "var(--text)", fontSize: "0.9rem" }}>{desc}</td>
      <td style={{ padding: "0.75rem", fontFamily: "var(--font-mono)", fontSize: "0.8rem", color: "var(--text-muted)" }}>
        {example}
      </td>
    </tr>
  );
}

// 数据流转组件
function DataFlowItem({ from, to, desc }: { from: string; to: string; desc: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", fontSize: "0.9rem" }}>
      <span style={{ fontWeight: 500, color: "var(--accent)" }}>{from}</span>
      <span style={{ color: "var(--text-muted)" }}>→</span>
      <span style={{ fontWeight: 500 }}>{to}</span>
      <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>({desc})</span>
    </div>
  );
}

// 步骤卡片组件
function StepCard({ number, title, desc }: { number: number; title: string; desc: string }) {
  return (
    <div
      className="panel"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "1rem",
        padding: "1rem 1.25rem",
        background: "var(--bg-subtle)",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: "var(--accent)",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "1.1rem",
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        {number}
      </div>
      <div style={{ flex: 1 }}>
        <h4 style={{ fontSize: "1rem", fontWeight: 600, margin: "0 0 0.25rem 0" }}>{title}</h4>
        <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: 0 }}>{desc}</p>
      </div>
    </div>
  );
}
