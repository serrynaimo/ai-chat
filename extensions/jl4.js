/* JL4 CONTRACT COMPUTATION EXTENSION
 * for https://github.com/serrynaimo/ai-chat
 * by Thomas Gorissen
 */
CONFIG = Object.assign({
  JL4_API: '',
  JL4_KEY: ''
}, CONFIG)

// REGISTER USER PROMPT MODES WITH THE UI
MODES = Object.assign({
  jl4_legal: {
    name: 'Legal assessment',
    visible: true,
    placeholder: 'What would you like to assess?',
    tools: ['evaluate_policy', 'get_weather', 'search_web_info'],
    hello: jl4_hello,
    initialMessages: () => [{
      role: 'system',
      content: `You're a policy AI and always use the provided \`evaluate_policy\` tool call to, 1. Help you find out if you can help the user and, 2. assess a valid inquiry against your contracts on hand. The tool call evaluates your inputs against actual contracts, so the result from the tool is determenistically evaluated and always correct even if common sense or your pre-existing knowledge disagrees. Don't do math yourself, provide any explanations, caveats or findings of your own as the underlying contract or law might disagree but share the results from the tool call and list the reasoning steps that was evaluated, format it into an short yet information-dense response and highlight the key result relating to the user prompt in bold. You may execute the tool multiple times or use other tools to gather contextually relevant information to fill required inputs. Remind the user in the end that this is not yet actually legal advice. Now is ${new Date().toString()}.`
    }]
  },
  jl4_find_function: {
    name: 'Finds a relevant function/contract',
    initialMessages: (inquiry, functions = []) => [{
      role: 'system',
      content: `You're a paralegal AI. You assess a user policy inquiry against a list of function descriptions of contracts. Return up to 3 names of functions if they are relevant to asses the inquiry. Always respond in the form of a valid JSON array containing the exact function names.`
    }, {
      role: 'user',
      content: `Assess if any of the following functions could be useful for this inquiry: "${inquiry}"\n\nFunctions: ${JSON.stringify(functions)}`
    }]
  },
  jl4_paralegal: {
    name: 'Paralegal. Evaluates the function/contract',
    initialMessages: (inquiry, toolname) => [{
      role: 'system',
      content: `You're a paralegal AI. You always call the provided \`${toolname}\` tool call with the exact right parameters to analyse contract situation of the policy inquiry. If you receive errors, try again if you have sufficient detail. Proceed to describe the results in form of bullet points, then explain in a numbered list the reasoning decisions that were evaluated to get to the result. If you lack the required input detail to resolve errors, describe in detail what information you lack. `
    }, {
      role: 'user',
      content: `Call the provided tool correctly to evaluate the policy contract against this user inquiry: "${inquiry}"`
    }]
  },
  jl4_reasoning: {
    name: 'Trace reasoning summary',
    initialMessages: (trace, tool) => [{
      role: 'system',
      content: `You're a reasoning explainer AI. You explain in plain english (and ideally in less than 400 words) the logic that is executed behind this tool call: ${JSON.stringify(tool)}`
    }, {
      role: 'user',
      content: `Explain this reasoning trace: ${JSON.stringify(trace)}`
    }]
  }
}, MODES)


// ADD TOOL DEFINITION FOR THE MAIN LLM RUNNING THE USER PROMPT
TOOLS.unshift({
  type: "function", 
  function: {
      name: "evaluate_policy",
      description: "Find out if and how you can help the user with their policy inquiry. If valid, assesses the inquiry against the underying policy definition. Call only once.",
      parameters: {
          type: "object",
          properties: {
              inquiry: {
                  type: "string",
                  description: "All the latest details from the user inquiry inputs distilled from all user messages."
              }
          },
          required: ["inquiry"]
      }
  }
})


// TOOL FUNCTION EXECUTION
EXECUTE_TOOL.evaluate_policy = async ({ inquiry }, id) => {
  if (!inquiry.trim()) {
      throw new Error('No inquiry passed')
  }

  let tools = []
  let answers = []

  try {
      if(!window.jl4_function_cache?.length) {
          await jl4_load_func_list()
      }
      const functionsJson = await chatStreams[id].call({
          id: id + '-' + (window.toolcount++),
          model: getDefaultModel(),
          messages: MODES.jl4_find_function.initialMessages(inquiry, jl4_function_cache)
      })
      tools = (JSON.parse(functionsJson.content?.match(/(\[(\s*"[^"]*"\s*,?)*\s*\])/)?.[0]) || [])
        .reduce((a, t) => t.trim() ? [...a, { i: window.toolcount++, name: t }] : a, [])
      RENDER_TOOL.evaluate_policy({ functions_used: tools }, id)
      
      for (const tool of tools) {
          const tid = id + '-' + tool.i
          let tdef = jl4_function_cache?.find(f => f.function.name === tool.name)
          if (!tdef?.function.parameters) {
              const jl4Response = await fetch(`${CONFIG.JL4_API}/functions/${tool.name.replace(/___/g, ' ')}`, {
                headers: {
                  'Authorization': `Bearer ${CONFIG.JL4_KEY}`
                }
              })
              if (!jl4Response.ok) {
                  throw new Error('Failed to provide jl4 results') 
              }
              const result = await jl4Response.json()
              result.function.name = result.function.name.replace(/ /g, '___')
              tdef = Object.assign(tdef, result)
          }
          const toolJson = await chatStreams[id].call({
              id: tid,
              model: getDefaultModel(),
              messages: MODES.jl4_paralegal.initialMessages(inquiry, tool.name),
              tools: [tdef]
          })
          answers.push(toolJson.content)
          await new Promise(resolve => setTimeout(resolve, 250))
      }
      if (!tools.length) {
          answers.push('No relevant policy found.')
      }
  } catch (e) {
      answers.push('Legal assessment failed. Conflict of interest.')
      console.error('Legal assessment failed for ' + id, e)
  }

  return { id, answers, functions_used: tools }
}

// RENDER TOOL RESULT IN CHAT MESSAGE STREAM using `appendTool({ html, id })`
RENDER_TOOL.evaluate_policy = (results, id) => {
    const parts = String(id).split('-')
  if (loadedChatId?.toString() === parts[0] && results.functions_used?.length) {
    results.functions_used.forEach(f => window.RENDER_TOOL[f.name] = jl4_render_eval_result)
    appendTool({ html: `<p>Assessing policies ...</p><ol>${results.functions_used.map(t => `<li><strong>Relevant policy: <code class='policy'>${jl4_policy_translate(t.name)}</code></strong><br><div id='${id + '-' + t.i}' class="subcontent"></div></li>`).join('')}</ol>`, id })
  }
}

function jl4_render_eval_result(results, id) {
  if (results?.args) {
    appendTool({ html: `<p>Applying prompt and context information:</p><ul class='items'>${Object.keys(results.args)?.map(k => `<li>${k}: <code>${results.args[k]}</code></li>`).join('')}</ul>`, id })
  }
  if (results?.values) {
    appendTool({ html: `<p>Decision</p><ul class='items'>${results.values?.map(v => `<li>${v[0]}: <code>${v[1]}</code></li>`).join('')}</ul>`, id })
  }
}

// HANDLE THE TOOL CALL EXECUTION OF FUNCTIONS IN jl4_function_cache
async function jl4_eval_func (func, args, id) {
  // Use jl4 for legal assessment
  const tdef = window.jl4_function_cache?.find(f => f.function.name === func)
  if(!tdef) {
      throw Error('Not a valid tool call')
  }

  jl4_render_eval_result({ args }, id)

  const response = await fetch(`${CONFIG.JL4_API}/functions/${func.replace(/___/g, ' ')}/evaluation`, {
      method: 'POST',
      headers: {
          'Content-type': 'application/json',
          'Authorization': `Bearer ${CONFIG.JL4_KEY}`
      },
      body: JSON.stringify({
          fnArguments: args,
          fnEvalBackend: 'jl4'
      })
  })
  if (!response.ok) {
      throw Error('Failed to evaluate jl4 function')
  }
  const result = await response.json()
  if (!result.tag.match(/Error/i)) {
    jl4_render_eval_result(result.contents, id)
  }
  return Object.assign(result.contents, { args })
}

async function jl4_hello () {
  if (!document.body.classList.contains('new')) return
  clearMemory()
  if(await jl4_load_func_list()) {
    await appendMessage({ text: `<h4>Available policies for evaluation</h4><p>${jl4_function_cache.map(f => `<code style='cursor: pointer;' class='policy' onclick='jl4_render_func("${f.function.name}")'>${jl4_policy_translate(f.function.name)}</code>`).join(', ')}</p>`, sender: 'assistant' })
  } else {
    await appendMessage({ text: `Could not access JL4 API`, sender: 'system' })
  }
}

async function jl4_render_func (name) {
  if (document.body.classList.contains('generating')) return
  clearMemory()
  document.body.classList.remove('new')
  let tdef = jl4_function_cache?.find(f => f.function.name === name)
  if (!tdef?.function.parameters) {
      const jl4Response = await fetch(`${CONFIG.JL4_API}/functions/${name.replace(/___/g, ' ')}`, {
        headers: {
          'Authorization': `Bearer ${CONFIG.JL4_KEY}`
        }
      })
      if (!jl4Response.ok) {
          throw new Error('Failed to provide jl4 results') 
      }
      tdef = Object.assign(tdef, await jl4Response.json())
  }
  const props = tdef.function.parameters.properties || {}
  const reqs = tdef.function.parameters.required || []
  await appendMessage({ text: `<strong>Description for <code class='policy'>${jl4_policy_translate(tdef.function.name)}</code></strong><p>${tdef.function.description}</p><ul>${Object.keys(props).map(k => `<li><code${reqs?.includes(k) ? ` style='text-decoration: underline;'` : ''}>${k}</code><i>${props[k].type}</i>: ${props[k].description}</li>`).join('')}</ul>`, sender: 'assistant', id: loadedChatId})
}

// ONLOAD UPDATE FUNCTION CACHE
async function jl4_load_func_list () {
  const response = await fetch(`${CONFIG.JL4_API}/functions`, {
    headers: {
      'Authorization': `Bearer ${CONFIG.JL4_KEY}`
    }
  })
  if (!response.ok) {
    console.error('Failed to load jl4 functions')
    return false
  }       
  jl4_function_cache = (await response.json()).map(f => {
    f.function.name = f.function.name.replace(/ /g, '___')
    return f
  })
  jl4_function_cache.forEach(f => {
    EXECUTE_TOOL[f.function.name] = jl4_eval_func.bind(window, f.function.name)
  })
  return true
}

// ADD SETTING INPUTS
const d = document.createElement('div')
d.innerHTML = `<h4>JL4 API</h4><input type="text" id="JL4_API" placeholder="API URL" autocorrect="off" data-default="" class="setting" /><input type="text" id="JL4_KEY" placeholder="API key" autocorrect="off" autocomplete="off" data-default="" class="setting" />`
document.getElementById("extensionSettings").appendChild(d)

// GLOBAL VARIABLES FOR THIS EXTENSION
window.jl4_function_cache = []

function jl4_policy_translate(func) {
  func = func.replace(/___/g, ' ')
  return ({
    "compute_qualifies": "Compute Qualification Criteria",
    "is British citizen": "The British Citizen Act",
    "is qing": "Is Qing", 
    "numbers are big": "Big Number Evaluation",
    "parking_cost": "Parking Cost Regulation",
    "total fruit v3": "Total Fruit Policy Experiment",
    "vermin_and_rodent": "Household Insurance Terms"
  })[func] || func
}