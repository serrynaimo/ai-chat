MODES = Object.assign({
  lookup: {
    name: 'Lookup',
    visible: true,
    placeholder: 'What would you like to know?',
    tools: ['search_web_info', 'get_weather', 'search_user_history', 'solve_math', 'solve_complex_math', 'generate_image', 'render_chart', 'stock_quotes'],
    initialMessages: () => [{
      role: 'system',
      content: 'You\'re a information retrieval and answering AI and always start by using the `search_web_info` tool or other tools to retrieve relevant and up-to-date information BEFORE you give any uninformed reply.'
        + `\n${window.CONFIG.SYSTEM_PROMPT || ''} ${window.CONFIG.USER_INFO ? `\nHere is some information the user would like you to know in general. Never reference it directly in your response but use it to relate better with the user!\n"${window.CONFIG.USER_INFO}"` : ''}\nNow is ${new Date().toString()}`
    }]
  },
  research: {
    name: 'Research',
    visible: true,
    placeholder: 'What can I research for you?',
    tools: ['spawn_research_agents'],
    initialMessages: () => [{
      role: 'system',
      content: 'You\'re a information retrieval and research AI that responds with a detailed and information-dense report. Always use the `spawn_research_agents` tool to gather in-depth information and context BEFORE writing the report.'
        + `\n${window.CONFIG.SYSTEM_PROMPT || ''} ${window.CONFIG.USER_INFO ? `\nHere is some information the user would like you to know in general. Never reference it directly in your response but use it to relate better with the user!\n"${window.CONFIG.USER_INFO}"` : ''}\nNow is ${new Date().toString()}`
    }]
  },
  chat: {
    name: 'Chat',
    visible: true,
    placeholder: 'What\'s on your mind?',
    tools: ['search_web_info', 'get_weather', 'search_user_history', 'solve_math', 'solve_complex_math', 'generate_image', 'render_chart', 'stock_quotes'],
    initialMessages: () => [{
      role: 'system',
      content: 'You\'re a chat AI. Use tools only when necessary to be most helpful.'
        + `\n${window.CONFIG.SYSTEM_PROMPT || ''}\n${window.CONFIG.USER_INFO ? `Here is some information the user would like you to know in general. Never reference it directly in your response but use it to relate better with the user!\n"${window.CONFIG.USER_INFO}"` : ''}\nNow is ${new Date().toString()}`
    }]
  },
  improve: {
    name: 'Improve',
    visible: true,
    placeholder: 'What message do you want to improve?',
    tools: ['spawn_research_agents'],
    initialMessages: message => [
      {
        role: 'system',
        content: 'Your a social media post improvement AI. You use the spawn_research_agents tool to look-up related trending topics or other relevant input and use that information to suggest three versions of the content that would be more viral without changing the character and based on: Conciseness, Confidence & Clarity, Emotional Appeal, Trends & Relevance, Novelty & Surprise, Authenticity & Relatability, Humor & Entertainment Value, Practicality, Storytelling Elements, Call to Action and maybe a bit of controversy. Avoid the use of hashtags.'
          + `\n${window.CONFIG.SYSTEM_PROMPT || ''} ${window.CONFIG.USER_INFO ? `\nHere is some information the user would like you to know in general. Never reference it directly in your response but use it to relate better with the user!\n"${window.CONFIG.USER_INFO}"` : ''}\nNow is ${new Date().toString()}`
      }, {
        role: 'user',
        content: 'Give me three better versions for this message:\n\n' + message
      }
    ]
  },
  titleize: {
    name: 'Create title for chat history',
    initialMessages: prompt => [{
        role: 'system',
        content: 'You\'re an AI with the sole purpose to summarise user prompts as a title to identify them again later quickly.'
    }, {
        role: 'user',
        content: 'Summarise the following prompts in one title with less than 10 words. Output only the title without any further explanation or added context!\n\n' + prompt
    }]
  },
  suggestFollowUps: {
    name: 'Suggest three follow-ups',
    initialMessages: content => [{
        role: 'system',
        content: 'You\'re an AI with the sole purpose to suggest the three most relevant follow up topics or answers to questions in a given text. Each suggestion should be less than 8 words. Always respond in the form of a valid JSON array containing the suggestions as strings.'
    }, {
        role: 'user',
        content: 'Return the JSON array with short follow up topics or suggestions for answers to questions in this text:\n\n' + content
    }]
  },
  sayHello: {
    name: 'Welcome the user',
    placeholder: '<b>Howdy</b>, is it time to help again?',
    initialMessages: history => {
      let content = ''
      if (history?.length) {
        content += '\nHere are some previous user chat logs with you that you could reference on the occasion:'
        let i = 1;
        history.slice(0, 10).forEach(h => {
            content += `\n${1}.: ${h.log[0].content?.substring(0, 255)}`
        })
      }
      return [{
        role: 'system',
        content: `You\'re a professional entertainer. You MUST always use less than 30 words in your response!\n\n${window.CONFIG.USER_INFO ? `Here is some information the user would like you to know in general. Never reference it directly in your response but use it to relate better with the user!\n"${window.CONFIG.USER_INFO}"` : ''}`,
      }, {
        role: 'user',
        content: `Say hello and ask how to help. It\'s okay to be mildly cynical. Highlight your greeting and first short sentence in bold.\n\n${content}`,
      }]
    }
  },
  researchAgent: {
    name: 'Researching a topic',
    tools: ['search_web_info', 'get_weather', 'search_user_history'],
    initialMessages: (topic, context) => [{
        role: 'system',
        content: 'You\'re an AI agent with the sole purpose to research one specific topic in a lot of detail by querying for relevant content. Summarize key findings using lists or data tables and only short paragraphs of text. Use the tools at your disposal. Now is ' + new Date().toString()
    }, {
        role: 'user',
        content: `Research this topic in detail and summarise your findings: "${topic}" in the context of "${context}"`
    }],
  },
  clarify: {
    name: 'Clarify and disambiguate the user prompt',
    tools: ['search_web_info', 'search_user_history', 'solve_math', 'stock_quotes', 'get_weather'],
    initialMessages: (prompt) => [{
        role: 'system',
        content: 'You\'re an AI agent with the sole purpose to improve a user prompt. Use the `search_user_history` or other tools to establish very relevant contextual information, clarify on the correct use and meaning/disambiguation of terms then rephrase and return the improved prompt with clarity and context without implying an answer or response to facilitate understanding.'
    }, {
        role: 'user',
        content: `Improve this user prompt: "${prompt}"`
    }]
  },
  verify: {
    name: 'Verify information and suggest improvements',
    tools: ['search_web_info', 'get_weather', 'search_user_history', 'solve_math', 'solve_complex_math', 'stock_quotes'],
    initialMessages: (context, info) => [{
        role: 'system',
        content: 'You\'re an AI agent with the sole purpose to double-check the key finding to be most accurate and useful for a given prompt, suggest improvements and correct mistakes then summarize they key findings using a bullet point lists. Research critical questions by using tools.'
    }, {
        role: 'user',
        content: `Suggest ways to improve mistakes or errors on the following information for the prompt of "${context}":\n\n${info}`
    }]
  }
}, MODES)
