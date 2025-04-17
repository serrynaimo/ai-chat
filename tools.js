TOOLS = [{
  type: "function", 
  function: {
      name: "search_web_info",
      description: "Search the web for current information about a precise topic. Only use when asked about current events or specific information that need verification. Only use once.",
      parameters: {
          type: "object",
          properties: {
              query: {
                  type: "string",
                  description: "The search query or keywords"
              }
          },
          required: ["query"]
      }
  }
}, {
  type: "function",
  function: {
      name: "solve_math",
      description: "Helps to solve simple math accurately by executing it in JavaScript and returning the result",
      parameters: {
          type: "object",
          properties: {
              code: {
                  type: "string",
                  description: "The math to solve converted to valid JavaScript code (No use of variables!)"
              }
          }
      },
  }
}, {
    type: "function",
    function: {
        name: "solve_complex_math",
        description: "Helps to solve complex math that requires custom algorithms/function implementations and variables with data accurately by executing it in JavaScript and returning the result. Allows you to create your own algorithms and run them. E.g. for IRR, NPV, others",
        parameters: {
            type: "object",
            properties: {
                data: {
                    type: "string",
                    description: "The data as JSON array of objects required to run the algorithm"
                },
                algorithm: {
                    type: "string",
                    description: "The self-executing JavaScript closure that can calculate the result. A `data` variable holds the pre-parsed data array."
                }
            },
            required: ["data", "algorithm"]
        },
    }
}, {
    type: "function",
    function: {
        name: "render_chart",
        description: "Renders a lightweight-charts.js v4.2.3 chart to visualise time-based data",
        parameters: {
            type: "object",
            properties: {
                chartcode: {
                    type: "string",
                    description: "The JavaScript code to render the chart using lightweight-charts.js in version 4.2.3 (using LightweightCharts variable) inside of a self-executing closure and rendering it into the existing element referenced with variable name `chartElement`. Use chartElement.clientWidth as width and 350px as height, transparent as background color, #1f87cd as primary data color and #aaaaaa for text."
                }
            },
            required: ["chartcode"]
        },
    }
}, {
  type: "function",
  function: {
      name: "search_user_history",
      description: "Retrieve the conversation history with the user by single key words. Use it to personalise or to find additional context from the past",
      parameters: {
          type: "object",
          properties: {
              keywords: {
                  type: "array",
                  items: {
                      type: "string"
                  },
                  description: "Key words to look for. Singular and plural matters."
              }
          }
      },
  }
}, {
  type: "function",
  function: {
      name: "spawn_research_agents",
      description: "Research a topic or problem statement in detail and gather the most recent and accurate information. Call only once.",
      parameters: {
          type: "object",
          properties: {
              context: {
                  type: "string",
                  description: "A short summary of the user prompt and relevant user context"
              },
              key_topic: {
                  type: "string",
                  description: "The most important key topic you require to understand in detail to give a good answer."
              },
              helpful_topic: {
                  type: "string",
                  description: "Another important or helpful set of information or a different angle on the question you need up-to-date and relevant information on"
              },
              approach: {
                  type: "string",
                  description: "A helpful approach or method that you want to understand better to evaluate the other information"
              },
              challange: {
                  type: "string",
                  description: "A prompt that challenges your current assumptions to see if they hold up"
              }
          },
          required: ["context", "key_topic", "challenge"]
      }
  }
}, {
  type: "function",
  function: {
      name: "get_weather",
      description: "Retrieve the current or 7-day forecasted weather information at a specific latitude and longitude, only if asked",
      parameters: {
          type: "object",
          properties: {
              latitude: {
                  type: "number",
                  description: "The exact latitude of the location on planet earth"
              },
              longitude: {
                  type: "number",
                  description: 'The exact longitude of the location on planet earth'
              },
              temp_unit: {
                  type: "string",
                  description: "Unit the temperature will be returned in",
                  enum: ['fahrenheit', 'celsius']
              },
              speed_unit: {
                  type: "string",
                  description: "Unit the wind speed will be returned in",
                  enum: ['kmh', 'mph']
              },
              forecast: {
                  type: "boolean",
                  description: "False returns the current weather. True the 7-day forecast."
              }
          },
          required: ["latitude", "longitude", "forecast"]
      },
  }
}, {
    type: "function",
    function: {
        name: "stock_quotes",
        description: "Queries for stock symbol information from alphavantage.co",
        parameters: {
            type: "object",
            properties: {
                func: {
                    type: "string",
                    description: "The alphavantage function code such as TIME_SERIES_DAILY, TIME_SERIES_INTRADAY, TIME_SERIES_WEEKLY, REAL_GDP, CPI, DIGITAL_CURRENCY_DAILY, ETF_PROFILE, TOP_GAINERS_LOSERS, etc..."
                },
                symbol: {
                    type: "string",
                    description: "The stock or ETF or currency symbol. E.g. IBM, TSLA, SPY, ... No support for indexes."
                },
                interval: {
                    type: "string",
                    description: "1min, 5min, etc... Required for TIME_SERIES_INTRADAY and some other functions"
                }
            },
            required: ["func"]
        },
    }
}, {
    type: "function",
    function: {
        name: "generate_image",
        description: "Generate an image based on a user prompt",
        parameters: {
            type: "object",
            properties: {
                prompt: {
                    type: "string",
                    description: "The description of the image"
                }
            },
            required: ["prompt"]
        },
    }
  }, ...TOOLS]


// GENERAL TOOL FUNCTIONS
EXECUTE_TOOL.search_web_info = async ({ query }, id) => {
  if (!query.trim()) {
      throw new Error('No query or keywords passed')
  }
  const response = await fetch(`https://www.googleapis.com/customsearch/v1?key=${CONFIG.GOOGLE_CUSTOMSEARCH_API_KEY}&cx=${CONFIG.GOOGLE_CUSTOMSEARCH_ENGINE_ID}&q=${encodeURIComponent(query)}`)
  if (response.status === 403) {
      return { error: 'No Google Custom Search key or Engine configured in AI chat settings.' }
  } else if (response.status === 429) {
      return { error: 'Too many earch requests for the day. Try again tomorrow.'}
  } else if (!response.ok) {
      throw new Error('Failed to provide search results') 
  }
  const data = await response.json()  
  const results = { id, query, results: data.items.map(i => ({ title: i.title, snippet: i.snippet, url: i.link })) }
  RENDER_TOOL.search_web_info(results, id)
  return results
}

EXECUTE_TOOL.solve_math = async ({ code }, id) => {
  if (!code || typeof code !== 'string') {
    throw new Error('No valid math provided')
  }
  try {
    const result = new Function('return (function() { return ' + code + '; })()')()
    const response = { id, code, result }
    RENDER_TOOL.solve_math(response, id)
    return response
  } catch (error) {
    return { id, error }
  }
}

EXECUTE_TOOL.solve_complex_math = async ({ data, algorithm }, id) => {
    if (!algorithm || typeof algorithm !== 'string') {
        throw new Error('No valid math provided')
      }
      try {
        const result = new Function('let data = arguments[0]; const func = ' + algorithm + '; return typeof func === "function" ? func(data) : func;')(JSON.parse(data) || [])
        const response = { id, data, algorithm, result }
        RENDER_TOOL.solve_complex_math(response, id)
        return response
      } catch (error) {
        return { id, error }
      }
}

EXECUTE_TOOL.render_chart = async ({ chartcode }, id) => {
    if (!chartcode || typeof chartcode !== 'string') {
        throw new Error('No valid chartcode provided')
      }
      try {
        const rendered = RENDER_TOOL.render_chart({ id, chartcode }, id)
        return { id, chartcode, result: rendered ? 'Successfully rendered chart!' : 'Could not render chart. Code was not in a self-executing closure or otherwise incompatible with LightweightCharts v4.2.3'}
      } catch (error) {
        return { id, error }
      }
}

EXECUTE_TOOL.stock_quotes = async ({ symbol, func, interval }, id) => {
    const key = window.CONFIG.ALPHAVANTAGE_KEY
    if (!key) {
        throw new Error('No Alpha Vantage key configured in AI chat settings.')
    }
    const response = await fetch(`https://www.alphavantage.co/query?function=${func}&symbol=${symbol}&apikey=${key}`)
    const data = await response.json()
    const results = { id, info: data['Meta Data']?.['1. Information'], symbol, func, interval, data }
    RENDER_TOOL.stock_quotes(results, id)
    return results
  }

EXECUTE_TOOL.get_weather = async ({ latitude, longitude, speed_unit = 'kmh', temp_unit = 'celsius', forecast = true }, id) => {
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}`
      + (forecast
          ? '&daily=temperature_2m_max,temperature_2m_min,relative_humidity_2m_mean,weather_code,wind_speed_10m_max,wind_direction_10m_dominant&forecast_days=7'
          : '&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m')
      + `&wind_speed_unit=${speed_unit}&temperature_unit=${temp_unit}`)
  const data = await response.json()
  
  const weatherCodes = { 0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Foggy', 48: 'Depositing rime fog', 51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle', 61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain', 71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow', 77: 'Snow grains', 80: 'Slight rain showers', 81: 'Moderate rain showers', 82: 'Violent rain showers', 85: 'Slight snow showers', 86: 'Heavy snow showers', 95: 'Thunderstorm', 96: 'Thunderstorm with slight hail', 99: 'Thunderstorm with heavy hail' }

  if (!forecast) {
      data.current.conditions = weatherCodes[data.current.weather_code] || 'Unknown'
      const results = { id, now: new Date().toString(), current: data.current }
      RENDER_TOOL.get_weather(results, id)
      return results
  }

  const days = data.daily.time.map((date, index) => {
      return Object.keys(data.daily).reduce((acc, key) => {
          acc[key === 'time' ? 'date' : key] = data.daily[key][index]
          return acc
      }, { day: new Date(date).toLocaleString(undefined, { weekday: 'short', timeZone: 'UTC' }), conditions: weatherCodes[data.daily.weather_code[index]] || 'Unknown' })
  });

  const results = { id, now: new Date().toString(), forecast: days }
  RENDER_TOOL.get_weather(results, id)
  return results
}

EXECUTE_TOOL.search_user_history = async ({ keywords }, id) => {
  const list = typeof keywords === 'object' ? keywords.map(k => k.toLowerCase().trim()) : [keywords.toString().toLowerCase().trim()]
  const history = (JSON.parse(localStorage.getItem('history')) || []).filter(h => h.id !== loadedChatId)
  const matching_keywords = new Set()
  const matching = history.filter(h => list.find(l => {
        const r = h.name.toLowerCase().includes(l)
        if (r) {
            matching_keywords.add(l)
        }
        return r
    }) || h.log.find(m => m.role === 'user' && list.find(l => {
        const r = m.content.toLowerCase().includes(l)
        if (r) {
            matching_keywords.add(l)
        }
        return r
  })))
  const logs = (list?.length ? matching : history)?.slice(0, 10)
  const results = {
      id,
      keywords: list,
      matching_keywords: list?.length ? Array.from(matching_keywords) : undefined,
      description: (list?.length ? `${matching.length} previous conversations matching the given keywords` : `Latest ${logs.length} conversations`) + ' of ' + history.length + ' total past conversations with this user.',
      results: logs.map(l => {
        l.log = l.log.reduce((a, v) => (v.role === 'user' ? [...a, v] : a), [])
        return l
      })
  }
  RENDER_TOOL.search_user_history(results, id)
  return results
}

EXECUTE_TOOL.spawn_research_agents = async (topics, id) => {
  const context = topics.context?.trim()
  topics = Object.keys(topics).reduce((a, v) => v !== 'context' && topics[v]?.trim() ? [...a, { i: window.toolcount++, topic: topics[v] }] : a, [])
  if (!topics?.length || !context) {
      throw new Error('No topic to research specified')
  }
  const addedSteps = [{ i: window.toolcount++, topic: 'Verifying results and synthesizing ...' }]
  RENDER_TOOL.spawn_research_agents({ topics: [...topics, ...addedSteps] }, id)
  await Promise.all(topics.map(async topic => {
      try {
          await new Promise(resolve => setTimeout(resolve, 250))
          const tid = id + '-' + topic.i
          const json = await chatStreams[id].call({
              id: tid,
              // model: getSummaryModel(),
              messages: MODES.researchAgent.initialMessages(topic.topic, context),
              tools: TOOLS.filter(t => MODES.researchAgent.tools.includes(t.function.name))
          })
          topic.result = json.content?.replace(/<think>[\s\S]*<\/think>/g, '') || 'No information found'
          appendTool({ html: await markdownToHtml(topic.result), id: tid })
      } catch (e) {
          console.error('Could not research topic for ' + id, topic, e)
      }
  }))
  await Promise.all(addedSteps.map(async step => {
      try {
          await new Promise(resolve => setTimeout(resolve, 250))
          const sid = id + '-' + step.i
          const json = await chatStreams[id].call({
              id: sid,
              messages: MODES.verify.initialMessages(context, topics.map(t => t.result).join('\n\n')),
              tools: TOOLS.filter(t => MODES.verify.tools.includes(t.function.name))
          })
          step.result = json.content?.replace(/<think>[\s\S]*<\/think>/g, '') || 'Was unable to verify previous information'
          appendTool({ html: await markdownToHtml(step.result), id: sid })
      } catch (e) {
          console.error('Could not research step for ' + id, step, e)
      }
  }))
  return { id, topics: [...topics, ...addedSteps]  }
}

EXECUTE_TOOL.generate_image = async ({ prompt }, id) => {
    if (!prompt || typeof prompt !== 'string') {
      throw new Error('No valid prompt')
    }
    const model = getImageModel()
    if (!model) {
        throw new Error('No image model specified in AI chat settings.')
    }
    let images = [{ i: window.toolcount++, prompt: prompt }, { i: window.toolcount++, prompt: prompt }]
    RENDER_TOOL.generate_image({ images }, id)
    try {
      await Promise.all(images.map(async i => {
      try {
        const iid = id + '-' + i.i
        const json = await chatStreams[id].image({
            id: iid,
            model,
            prompt: i.prompt
        })
        i.prompt = json[0].revised_prompt || i.prompt
        i.url = json[0].url || json[0].b64_json
        appendTool({ html: `<a href='${i.url}' target='_blank'><img src='${i.url}' /></a>`, id: iid })
      } catch (e) {
          console.error('Could not generate image for ' + id, topic, e)
      }
  }))
      return { id, images }
    } catch (error) {
      return { id, error: 'Couldn\'t generate this image right now :(' }
    }
  }
// TOOL FUNCTIONS END



// TOOL RESULT RENDER FUNCTIONS
RENDER_TOOL.search_web_info = (results, id) => {
  const parts = id.split('-')
  if (loadedChatId?.toString() === parts[0] && results.id) {
      id = loadedChatId + '-' + (parts[1] || results.id.split('-')[1])
      appendTool({ html: `<p>Web search: ${results.query}</p><ul class="items">${results.results.slice(0, 5).map(r => `<li><img src="${new URL(r.url).origin}/favicon.png" onerror="faviconError(this)" /><a href="${r.url}" rel="noopener nofollow noreferrer" target="_blank" title="${r.title.replace(/"/, '\"')}">${new URL(r.url).hostname.replace('www.','')}</a></li>`).join('')}${results.results.length > 5 ? `<li><span>... ${results.results.length - 5} more</span></li>` : ''}</ul>`, id })
  }
}

RENDER_TOOL.solve_math = (results, id) => {
    const parts = id.split('-')
    if (loadedChatId?.toString() === parts[0] && results.id) {
        appendTool({ html: `<p>Doing math: <code class='code language-javascript'>${results.code.replace(';', '')} = ${results.result}</code></p>\n`, id })
    }
}

RENDER_TOOL.solve_complex_math = (results, id) => {
    const parts = id.split('-')
    if (loadedChatId?.toString() === parts[0] && results.id) {
        appendTool({ html: `<p>Solving complex math for data:\n\n\`\`\`json\n${results.data}\n\`\`\`\n\nUsing algorithm:\n\n\`\`\`javascript\n${results.algorithm}\n\`\`\`\n\nResult:\n\n\`\`\`json\n${JSON.stringify(results.result)}\n\`\`\`\n</p>\n`, id })
    }
}

RENDER_TOOL.render_chart = async (results, id) => {
    const parts = id.split('-')
    if (loadedChatId?.toString() === parts[0] && results.chartcode) {
        const tid = id + '-' + window.toolcount++
        await appendTool({ html: `<p>Visualising information:</p><div class='chart' id='chart-${tid}'><i style='text-align: center; display: block; padding: 2em;'>Model did not render this chart successfully</i></div>`, id })
        const f = new Function('LightweightCharts', 'chartElement', 'var window = { LightweightCharts }, document = { getElementById: () => chartElement }, func = ' + results.chartcode)
        const elem = document.getElementById('chart-' + tid)
        if (!window.LightweightCharts) {
            const s = document.createElement('scr' + 'ipt')
            s.src = 'https://cdn.jsdelivr.net/npm/lightweight-charts@4.2.3/dist/lightweight-charts.standalone.production.min.js'
            s.onload = function () {
                elem.innerHTML = ''
                f(window.LightweightCharts, elem)
            }
            document.body.appendChild(s)
        } else {
            elem.innerHTML = ''
            f(window.LightweightCharts, elem)
        }
        return !elem.innerHTML
    }
}

RENDER_TOOL.get_weather = (results, id) => {
  const parts = id.split('-')
  if (loadedChatId?.toString() === parts[0] && results.id) {
      id = loadedChatId + '-' + (parts[1] || results.id.split('-')[1])
      appendTool({ html: '<p>' + (results.forecast ? 'Checking the 7-day weather forecast ...' : 'Checking today\'s weather ...') + '</p>', id })
  }
}

RENDER_TOOL.stock_quotes = (results, id) => {
    const parts = id.split('-')
    if (loadedChatId?.toString() === parts[0] && results.id) {
        id = loadedChatId + '-' + (parts[1] || results.id.split('-')[1])
        appendTool({ html: `<p>Retrieving ${results.info || 'financial market information'} ${results.symbol ? `for <code>${results.symbol}</code>` : ''}...</p>`, id })
    }
  }

RENDER_TOOL.search_user_history = (results, id) => {
  const parts = id.split('-')
  if (loadedChatId?.toString() === parts[0] && results.id) {
      const content = results.results?.map(r => {
          return r.log?.length ? `<li><span title="${r.log[0].content.replace(/"/g, '\"')}">"${r.name}"</span></li>` : ''
      })
      id = loadedChatId + '-' + (parts[1] || results.id.split('-')[1])
      appendTool({ html: `<p>Reviewing history: ${results.keywords.slice(0, 5).join(', ')}</p><ul class="items">${content?.join('') || ''}</ul>`, id })
  }
}

RENDER_TOOL.spawn_research_agents = (results, id) => {
  const parts = id.split('-')
  if (loadedChatId?.toString() === parts[0]) {
    appendTool({ html: `<p>Researching ...</p><ol>${results.topics.map(t => `<li><strong>${t.topic}</strong><br><div id='${id + '-' + t.i}' class="subcontent"></div></li>`).join('')}</ol>`, id })
  }
}

RENDER_TOOL.generate_image = (results, id) => {
    const parts = id.split('-')
    if (loadedChatId?.toString() === parts[0]) {
      appendTool({ html: `<p>Generating images ...</p><div class='images'>${results.images.map(i => `<div class='image' id='${id + '-' + i.i}'>${i.url ? `<div class='content'><a href='${i.url}' target='_blank'><img src='${i.url}' onerror='this.parentNode.parentNode.remove()' /></a></div>` : ''}</div>`).join('')}</div>`, id })
    }
  }
// TOOL RESULT RENDER FUNCTIONS END