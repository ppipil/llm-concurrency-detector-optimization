1. # Research Plan v2

   ## 1. 暂定题目

   **Performance-Aware Context Management for LLM-Based Code Performance Optimization**

   中文：

   **面向 LLM 代码性能优化的性能感知上下文管理方法**

   一句话概括：

   > 研究怎样利用真实 profiler 信息和历史优化结果，为 Coding Agent 动态选择最有价值的上下文，从而更有效地完成真实仓库级代码性能优化。

   ------

   ## 2. 我们到底要解决什么问题

   现在的 Coding Agent 已经会：

   ```
   读代码
   搜索代码
   修改代码
   运行命令
   跑测试
   ```

   但让它做 **performance optimization** 时还有两个问题。

   第一，它不一定知道：

   > **真正值得优化的地方在哪里。**

   即使有 profiler，也可能只是得到一堆：

   ```
   foo() 35%
   bar() 20%
   baz() 12%
   ...
   ```

   “最热”不一定等于“最值得改”。

   比如第三方库可能占 60%，但根本不应该改。

   第二，Agent 每次修改后会产生很多有价值的真实信息：

   ```
   这个修改有没有变快？
   快了多少？
   测试有没有挂？
   原来的 hotspot 消失了吗？
   这个方向是不是已经试过两次都没效果？
   ```

   这些信息如果没有被系统化利用，下一轮 Agent 仍可能重复走无效路线。

   ------

   # 3. Research Gap

   我们的工作假设是：

   现有方法已经开始使用 profiler 引导 Coding Agent，但仍缺少一个明确的机制去回答：

   > **在有限 context budget 下，到底应该把哪些 performance evidence、源码和历史优化经验提供给 Agent？**

   因此我们不研究：

   > “Profiler 对 Agent 有没有帮助？”

   这个问题太简单，而且已有工作已经涉及。

   我们研究的是：

   > **怎样选择和组织 profiler evidence，以及怎样利用经过真实 benchmark/test 验证的历史经验。**

   Related Work 阶段需要进一步用论文证明这个 gap，不能只靠我们自己声称。

   ------

   # 4. Research Questions

   ### RQ1 — Performance-aware context selection

   > **Does performance-aware context selection improve LLM coding agents' effectiveness in repository-level code performance optimization compared with vanilla and profiler-only approaches?**

   人话：

   > 不是什么 profiler 信息都给 Agent，而是我们挑选真正值得看的信息以后，它是不是优化得更好？

   ------

   ### RQ2 — Outcome-grounded experience reuse

   > **Can outcome-grounded optimization experience reduce ineffective attempts and improve subsequent performance optimization?**

   人话：

   > 把之前真正跑过 benchmark/test 的成功和失败经验利用起来，Agent 后面是不是能少走弯路？

   ------

   # 5. Proposed Method

   整个框架固定为：

   ```
                Performance Task
                       ↓
             Baseline Benchmark
                       ↓
                   Profiler
                       ↓
           Performance Evidence
                       ↓
        ┌────────────────────────┐
        │ Performance-Aware      │
        │ Context Manager        │
        └───────────┬────────────┘
                    ↓
          Selected Optimization
                Context
                    ↓
           Coding Agent
         Pi + CSLab DeepSeek
                    ↓
                  Patch
                    ↓
          ┌─────────┴──────────┐
          ↓                    ↓
    Correctness Tests       Benchmark
          ↓                    ↓
          └─────────┬──────────┘
                    ↓
             Outcome Analysis
                    ↓
         Optimization Experience
                    ↓
          后续 iteration / task
   ```

   ------

   # 6. Module A：Performance Evidence Collector

   这一层全部由**代码**完成，不让 LLM 猜。

   收集：

   ```
   hot function
   self time
   total time
   runtime share
   call count
   call path
   source file
   source line
   ```

   同时记录：

   ```
   baseline runtime
   correctness tests
   repository state
   ```

   Profiler 只是数据来源，**Profiler 本身不是创新点**。

   ------

   # 7. Module B：Performance-Aware Context Selector

   这是**核心贡献 1**。

   Profiler 找到很多 hotspot 后，不全部交给 Agent。

   我们先为候选目标计算优先级。

   第一版冻结为：

   ```
   Priority(h) =
   
   α × RuntimeImportance
   + β × CallFrequency
   + γ × Editability
   + δ × HistoricalGain
   
   - λ × RegressionRisk
   - μ × TriedPenalty
   ```

   其中：

   **RuntimeImportance**

   这个函数到底占多少 runtime。

   **CallFrequency**

   是不是大量重复调用。

   **Editability**

   是不是当前 repo 自己的代码，Agent 是否实际可以修改。

   例如：

   ```
   numpy.matmul
   runtime share = 55%
   
   但是：
   third-party/native code
   
   Editability ↓
   ```

   所以不能单纯因为它最热就排第一。

   **HistoricalGain**

   类似优化目标过去是否出现过有效方法。

   **RegressionRisk**

   过去修改类似区域是否造成 correctness regression。

   **TriedPenalty**

   当前 task 里已经连续尝试两三次且收益很低，就降低优先级。

   ------

   ## 8. Context Builder

   选出 Top-K target 后，再构造真正提供给 Agent 的上下文。

   例如：

   ```
   OPTIMIZATION TARGET
   
   Function:
   prepare_data()
   
   Location:
   data.py:42-89
   
   Runtime contribution:
   28%
   
   Call count:
   102,341
   
   Relevant call path:
   load()
   → preprocess()
   → prepare_data()
   
   Relevant source:
   data.py:42-89
   
   Relevant tests:
   test_data.py
   test_pipeline.py
   
   Reason for selection:
   High call frequency;
   project-owned code;
   no previous optimization attempt.
   ```

   所以我们不是：

   ```
   把整份 profiler log 塞进去
   ```

   而是：

   > **经过程序选择后的 bounded performance context。**

   Context budget 也固定控制，比如只提供：

   ```
   Top 1–3 targets
   +
   相关代码
   +
   关键 tests
   +
   少量历史经验
   ```

   避免 context 无限膨胀。

   ------

   # 9. Coding Agent

   这一部分**不是我们的创新**。

   暂定：

   ```
   Agent Harness：
   Pi Mono
   
   LLM：
   CSLab DeepSeek
   ```

   Pi负责：

   ```
   read
   search
   edit
   bash
   test
   ```

   DeepSeek负责：

   ```
   代码理解
   推理
   生成修改
   ```

   Codex只用于：

   > **帮我们开发研究系统。**

   Codex **不参加正式实验**。

   如果 Pi 和 CSLab 的接口最终存在硬性兼容问题，可以换 SWE-agent 等开源 harness，但：

   > **Research Question、方法和实验设计不改变。**

   ------

   # 10. Module C：Outcome Evaluator

   Agent 修改以后，**不相信 Agent 自己说成功了。**

   自动运行：

   ```
   correctness tests
   +
   benchmark
   +
   必要时 re-profile
   ```

   结果统一分成：

   ```
   SUCCESS
   tests pass + meaningful speedup
   
   NO_GAIN
   tests pass + negligible speedup
   
   REGRESSION
   tests fail
   
   PERFORMANCE_REGRESSION
   tests pass + slower
   ```

   例如：

   ```
   Before:
   2.40 s
   
   After:
   1.92 s
   
   Tests:
   PASS
   
   Speedup:
   1.25×
   
   Hotspot:
   28% → 11%
   ```

   这些都是真实 execution evidence。

   ------

   # 11. Module D：Outcome-Grounded Experience

   这是**核心贡献 2**。

   不是把整个 Agent trajectory 存进 Memory。

   而是把一次优化压缩成结构化 experience：

   ```
   Pattern:
   high-frequency repeated preprocessing
   
   Target:
   prepare_data()
   
   Action:
   hoisted invariant conversion outside loop
   
   Outcome:
   1.25× speedup
   
   Correctness:
   PASS
   
   Profiler effect:
   runtime share 28% → 11%
   
   Confidence:
   HIGH
   ```

   失败也记录：

   ```
   Pattern:
   mutable input + caching
   
   Action:
   memoization
   
   Outcome:
   1.40× apparent speedup
   
   Correctness:
   FAIL
   
   Failure:
   stale cached result
   ```

   关键规则：

   > **Experience 必须由真实 tests + benchmark grounding。**

   不是 LLM 自己觉得：

   > “这是一个好经验。”

   ------

   # 12. Experience Retrieval

   新的 task / 新一轮优化开始时，根据当前 target 检索历史经验。

   第一版不要复杂化。

   采用：

   ```
   规则过滤
   +
   简单 semantic similarity
   ```

   最多返回：

   ```
   Top 2–3 successful experiences
   +
   Top 1 relevant failed experience
   ```

   例如：

   ```
   Relevant previous experience:
   
   SUCCESS:
   Repeated allocation was reduced by object reuse.
   Measured speedup: 1.31×.
   
   FAILURE:
   Caching mutable inputs caused a correctness regression.
   ```

   然后加入本轮 context。

   ------

   # 13. 我们暂时不做真正 Self-Evolution

   这个决定也冻结。

   Interim 阶段不要声称：

   > Self-Evolving Coding Agent

   更准确的词是：

   > **adaptive / outcome-grounded experience reuse**

   因为我们目前只是：

   ```
   过去执行结果
   → 影响未来 context 和 optimization decision
   ```

   还没有：

   ```
   自动改系统 Prompt
   自动修改 Tool
   自动训练 policy
   自动生成新 Harness
   ```

   这些放 Future Work。

   ------

   # 14. Baselines

   最终实验至少设置三组。

   ### B0 — Vanilla Coding Agent

   ```
   Task
   +
   Repository
   +
   Pi + DeepSeek
   ```

   不给额外 profiler guidance。

   ------

   ### B1 — Profiler-Guided Agent

   模拟现有 profiler-guided 方法：

   ```
   Task
   +
   Profiler hotspot summary
   +
   Pi + DeepSeek
   ```

   这里不做我们自己的复杂 selection。

   ------

   ### B2 — Ours: Performance-Aware Context

   ```
   Profiler
   ↓
   Target Ranking
   ↓
   Relevant Code / Call Path / Tests
   ↓
   Budgeted Context
   ↓
   Pi + DeepSeek
   ```

   用来回答 RQ1。

   ------

   ### B3 — Full Method

   ```
   Performance-Aware Context
   +
   Outcome-Grounded Historical Experience
   ```

   用来回答 RQ2。

   Interim Report 前：

   > **B0、B1、B2 必须尽量跑通。**

   B3 至少完成设计 + MVP，正式大规模实验可以放 Final。

   ------

   # 15. Evaluation Metrics

   主要指标冻结为四个：

   ### ① Correctness

   ```
   tests pass / fail
   ```

   ### ② Speedup

   ```
   Speedup =
   baseline runtime / optimized runtime
   ```

   例如：

   ```
   2.0s / 1.5s = 1.33×
   ```

   ### ③ Optimization Success Rate

   多少 task 最后实现：

   ```
   tests pass
   +
   meaningful performance improvement
   ```

   ### ④ Optimization Cost

   记录：

   ```
   iterations
   tool calls
   token usage
   wall-clock time
   ```

   其中前三个是核心，成本指标是辅助。

   ------

   # 16. Benchmark / Tasks

   主要参考：

   > **SWE-efficiency / 真实 GitHub performance optimization tasks**

   但 Interim 阶段不需要跑几百题。

   先选：

   > **3–5 个 Windows 下容易复现的小 task。**

   要求：

   ```
   真实 repo
   明确 workload
   可重复测 runtime
   有 correctness tests
   修改空间明确
   ```

   正式 Final 再增加任务数量。

   由于我们坚持：

   > **Native Windows only**

   任何任务选取都以可复现性优先。

   ------

   # 17. 与原 Topic #7 的关系

   原始 Topic 是：

   > **An Empirical Study on Concurrency Bug Detection Tools due to LLM-based Code Optimization**

   我们的研究重点根据老师后续关于 **performance improvement / SWE-efficiency** 的建议，转向：

   > **LLM-based code performance optimization methodology**

   Interim 阶段优先把方法做通。

   Final 阶段如果可行，再加入至少一个：

   > concurrency / program-analysis related tool

   作为 targeted case study。

   但是：

   > **不再为了满足这一点提前花大量时间找老 detector。**

   ------

   # 18. Expected Contributions

   现在冻结为两项主要贡献。

   ### Contribution 1

   > **A performance-aware context selection mechanism**

   利用真实 runtime evidence、代码可修改性、调用关系、历史尝试和风险信息，选择有限 context budget 下最值得提供给 Coding Agent 的优化信息。

   ### Contribution 2

   > **An outcome-grounded optimization experience mechanism**

   利用真实 correctness tests 和 benchmark 结果验证 Agent 的优化尝试，并把成功/失败结果转化成可复用经验，帮助后续优化决策。

   第三项是工程贡献，可以写，但不作为主要创新：

   > **A reproducible evaluation harness for profiling, optimization, correctness validation and performance measurement.**

   ------

   # 19. Research Hypothesis

   我们希望验证：

   ```
   Vanilla Agent
           <
   Profiler-Guided Agent
           <
   Performance-Aware Context Agent
   ```

   以及：

   ```
   Performance-Aware Context
           <
   Performance-Aware Context
   + verified historical experience
   ```

   但这是**hypothesis，不是预设实验结果**。

   如果最后没有提升，同样属于有效研究结果，需要分析原因。

   ------

   # 20. Prompt / Code 边界

   这一点也冻结，避免以后项目变成 Prompt Engineering。

   **代码负责：**

   ```
   profiling
   benchmark
   test execution
   hotspot extraction
   ranking
   context selection
   experience storage
   retrieval
   result calculation
   ```

   **LLM/Prompt负责：**

   ```
   理解筛选后的代码
   提出优化方案
   生成 patch
   必要时总结 experience 的自然语言部分
   ```

   原则是：

   > **Evidence 由程序决定，LLM负责 reasoning 和 coding。**

   ------

   # 21. Interim Report 前明确不做

   以下全部暂停：

   ```
   Jev
   真正 Self-Evolution
   多 Agent
   MCP 产品化
   复杂 Skill 系统
   模型训练 / Fine-tuning
   学习型 Ranking Model
   MySQL / Redis
   复杂向量数据库
   大规模 benchmark
   ```

   它们不是现在的研究主线。

   ------

   # 22. Interim Report 最低完成标准

   10 月 20 日之前，我们需要真正拿出来的是：

   ```
   Research Plan          ✅
   Related Work           待完成
   Pi + CSLab DeepSeek    待验证
   3–5 candidate tasks    待筛选
   Profiler pipeline      待实现
   Vanilla baseline       待运行
   Profiler baseline      待运行
   Context Selector MVP   待实现
   1–3 preliminary cases  待运行
   Interim Report         待完成
   ```

   **不要求 Interim 前完成完整 Experience Learning 实验。**

   ------

   ## 最终用一句话记住这个项目

   以后如果我们又开始发散，就回来读这一句：

   > **我们不是在造一个新的 Coding Agent，而是在研究：如何利用真实性能证据和经过执行验证的历史经验，为固定的 Coding Agent 动态选择更有效的优化上下文，从而提高真实仓库级代码性能优化的成功率。**
