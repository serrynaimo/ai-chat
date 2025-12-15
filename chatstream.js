const ChatStream = (function() {
  class StreamController {
    #_isGenerating = false
    #_isDone = false
    #_isError = false
    #_response = ''
    #_messages = []
    #_isCancelled = false
    #id = null
    #tokenAmount = 0
    #startWaiting = null
    #startGeneration = null
    #toolCalls = []
    #lastThrottleTime = 0
    #queuedTokens = ''
    #throttleTimeout = null
    #statusInterval = null
    #model = null
    #options = {}
    #onToken = null
    #tokenThrottleMS = 80
    #statusIntervalMS = 250

    get isGenerating() {
      return this.#_isGenerating
    }

    get isDone() {
      return this.#_isDone
    }

    get isError() {
      return this.#_isError
    }

    get isCancelled() {
      return this.#_isCancelled
    }

    get response() {
      return this.#_response
    }

    get messages() {
      return this.#_messages
    }

    constructor(options = {}) {
      this.#options = options
      this.#model = options.model
      this.#id = options.id
    }

    async image({ id = this.#id, prompt, n = 1, model = this.#model }) {
      const response = await fetch(this.#options.apiUrl + '/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.#options.apiKey}`
        },
        body: JSON.stringify({
          model,
          prompt,
          n
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`)
      }

      const json = await response.json()
      return json.data
    }

    async call({ id = this.#id, messages, model = this.#model, tools = this.#options.tools, max_tokens = this.#options.max_tokens, temperature = this.#options.temperature }) {
        let result = await this.#completionsCall(id, messages, model, tools, max_tokens, temperature)
        this.#tokenAmount += JSON.stringify(result).length

        while (!this.#_isCancelled && this.#options.onToolCall && result?.tool_calls?.filter(this.#filterTools.bind(result.tool_calls))?.length) {
          messages.push({
            role: 'assistant',
            tool_calls: result.tool_calls.slice()
          })

          for (const tc of result.tool_calls) {
            try {
              const args = tc.function.arguments ? JSON.parse(tc.function.arguments) : undefined
              const result = await this.#options.onToolCall(tc.function.name, args, id)
              if (result) {
                messages.push({
                  role: 'tool',
                  content: JSON.stringify(result),
                  tool_call_id: tc.id
                })
              } else {
                throw new Error('No result')
              }
            } catch (e) {
              console.warn(`Tool call failed: ${tc.function.name}`, tc.function.arguments, e)
              messages.push({
                role: 'tool',
                content: 'Tool call failed',
                tool_call_id: tc.id
              })
            }
          }

          result = await this.#completionsCall(id, messages, model, tools, max_tokens, temperature)
          this.#tokenAmount += JSON.stringify(result).length
        }

        return result
    }

    async stream({ id = this.#id, messages, model = this.#model, tools = this.#options.tools, max_tokens = this.#options.max_tokens, temperature = this.#options.temperature }) {
      if (this.#_isGenerating) {
        return
      }

      this.#onToken = this.#options.onToken
      this.#tokenAmount = 0
      this.#toolCalls = []
      this.#startGeneration = null 
      this.#startWaiting = new Date()
      this.#_response = ''
      this.#_isCancelled = false
      this.#_isError = false
      this.#_isDone = false
      this.#_isGenerating = true
      this.#model = model
      this.#_messages = messages

      try {
        this.#options.onStart?.(id)
        this.#statusInterval = this.#options.onStatus ? setInterval(() => {
          this.#options.onStatus?.(this.#status(), id)
          if (!this.#_isGenerating && !this.#throttleTimeout) {
            clearInterval(this.#statusInterval)
            this.#options.onEnd?.(id)
          }
        }, this.#statusIntervalMS) : null;

        await this.#completionsCall(id, this.#_messages, model, tools, max_tokens, temperature, true)

        while (this.#options.onToolCall && !this.#_isCancelled && (this.#toolCalls = this.#toolCalls.filter(this.#filterTools.bind(this.#toolCalls))).length) {
          this.#_messages.push({
            role: 'assistant',
            tool_calls: this.#toolCalls.slice()
          })

          for (const tc of this.#toolCalls) {
            try {
              const args = tc.function.arguments ? JSON.parse(tc.function.arguments) : undefined
              const result = await this.#options.onToolCall(tc.function.name, args, id)
              if (result) {
                this.#_messages.push({
                  role: 'tool',
                  content: JSON.stringify(result),
                  tool_call_id: tc.id
                })
              }
            } catch (e) {
              console.warn(`Tool call failed for ${id}: ${tc.function.name}`, tc.function.arguments, e)
            }
          }

          this.#toolCalls = []
          await this.#completionsCall(id, this.#_messages, model, tools, max_tokens, temperature, true)
        }

        setTimeout(() => {
          if (!this.#_isCancelled) {
            this.#_isDone = true
            if (this.#queuedTokens) {
              this.#onToken?.(this.#queuedTokens, id)
              this.#queuedTokens = ''
            }
            if (this.#_response) {
                messages.push({
                  role: 'assistant',
                  content: this.#_response
                })
            }
            this.#options.onComplete?.(this.#_messages, this.#status(), id)
          }
        }, this.#tokenThrottleMS)
      } catch (error) {
        if (!this.#_isCancelled) {
          console.error('Error:', error)
          this.#_isError = true
          this.#options.onError?.(error, id)
        }
      } finally {
        this.#_isGenerating = false
      }
    }

    async #completionsCall(id, messages, model, tools, max_tokens, temperature, stream) {
      const response = await fetch(this.#options.apiUrl + '/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.#options.apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: messages.map(m => ({
            role: m.role,
            content: this.#formatFileContent(m),
            tool_call_id: m.tool_call_id,
            tool_calls: m.tool_calls
          })),
          tools,
          stream,
          max_tokens,
          temperature
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`)
      }

      if (!stream) {
        const json = await response.json()
        return json.choices[0].message
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let thinking = false

      while (true) {
        const { done, value } = await reader.read()
        if (done || this.#_isCancelled) break

        const chunk = decoder.decode(value)
        buffer += chunk

        while (buffer.includes('\n')) {
          const index = buffer.indexOf('\n')
          const line = buffer.substring(0, index + 1)
          buffer = buffer.substring(index + 1)

          try {
            if (line.match(/^Data: \{.*\}/i)) {
              const data = JSON.parse(line.substring(6))

              if (data.choices?.[0]?.delta) {
                const delta = data.choices[0].delta
                
                if (!this.#tokenAmount && !this.#startGeneration) {
                  this.#startGeneration = new Date()
                }

                if (delta.reasoning_content) {
                  if (!thinking) {
                    delta.reasoning_content = '<think>\n' + delta.reasoning_content
                    thinking = true
                  }
                  this.#_response += delta.reasoning_content
                  this.#throttleAppendToken(id, delta.reasoning_content)
                }
                else if (delta.content) {
                  if (thinking) {
                    delta.content = '</think>\n' + delta.content
                    thinking = false
                  }
                  this.#_response += delta.content
                  this.#throttleAppendToken(id, delta.content)
                } else if (delta.tool_calls?.length) {
                  delta.tool_calls.forEach(tc => {
                    if (thinking) {
                      thinking = false
                      this.#_response += '</think>\n'
                    }
                    if (this.#toolCalls.length <= tc.index) {
                      this.#toolCalls.push({
                        id: '',
                        type: 'function',
                        function: { name: '', arguments: '' }
                      })
                    }
                    const call = this.#toolCalls[tc.index || 0]
                    call.id += tc.id || ''
                    call.function.name += tc.function.name || ''
                    call.function.arguments += tc.function.arguments || ''
                  })
                }
              }
            }
          } catch (e) {
            console.error('JSON Parse Error:', e.message, 'Data:', line)
          }
        }
      }

      this.#_response += '\n '
      this.#throttleAppendToken(id, '\n ')
    }

    #filterTools(tc, index) {
      return !!tc.id && this.findIndex(i => 
        i.function?.name === tc.function?.name && 
        i.function?.arguments === tc.function?.arguments
      ) === index
    }

    #formatFileContent(message) {
      if (!message.files?.length) {
        return message.content
      }
      const content = [{ type: 'text', text: message.content?.trim() ? message.content : 'Explain' }]
      message.files.forEach(f => {
        if (!f.imageData) {
          content.push({
            type: 'text',
            text: `[File: ${f.name}]: ${f.text}` 
          })
        } else {
          content.push({
            type: 'image_url',
            image_url: { url: f.imageData }
          })
        }
      })
      return content
    }

    #throttleAppendToken(id, token) {
      clearTimeout(this.#throttleTimeout)
      this.#throttleTimeout = null

      if (!token && !this.#queuedTokens) return
      
      this.#tokenAmount++
      this.#queuedTokens += token || ''
      const now = Date.now()
      const timeSinceLast = now - this.#lastThrottleTime
      
      if (timeSinceLast < this.#tokenThrottleMS) {
        this.#throttleTimeout = setTimeout(() => this.#throttleAppendToken(id), timeSinceLast)
        return
      }

      this.#onToken?.(this.#queuedTokens, id)
      this.#queuedTokens = ''
      this.#lastThrottleTime = now
    }

    #status() {
      const timeToFirstToken = this.#startWaiting ? ((this.#startGeneration || new Date()).getTime() - this.#startWaiting.getTime()) / 1000 : null
      const generationTime = this.#startGeneration ? (new Date().getTime() - this.#startGeneration.getTime()) / 1000 : null
      const tokenPerSecond = this.#tokenAmount / generationTime
      return {
        state: this.#_isError ? 'Error' : (this.#_isCancelled ? 'Cancelled' : (this.#_isDone ? 'Done' : (this.#tokenAmount > 0 ? 'Generating ...' : 'Waiting for first token ...'))),
        generationTime: timeToFirstToken + generationTime,
        tokenPerSecond: isNaN(tokenPerSecond) ? 0 : tokenPerSecond.toFixed(2),
        tokens: this.#tokenAmount,
        timeToFirstToken,
        model: this.#model
      }
    }

    async stop() {
      return new Promise(resolve => {
        this.#_isCancelled = true
        this.#onToken = null
        this.#_isGenerating = false

        setTimeout(resolve, Math.max(this.#statusIntervalMS, this.#tokenThrottleMS))
      })
    }
  }

  return {
    create: function(options) {
      return new StreamController(options)
    }
  }
})() 