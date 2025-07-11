# AI Chat
A simple AI chat UI to connect to OpenAI v1 compatible API streaming endpoints. 

Supports markdown, code and math highlighting and uses local-storage for chat history.
Supports a few tool calls:
1. Basic web search with Google Custom Search credentials
2. Basic weather lookup from OpenMeteo
3. User chat history inquiries
4. Basic reasoning if you ask it to do research
5. Solving simple math
6. Generate images
7. Improve social media posts

Tested it with public APIs of Grok and Claude as well as different models running in LM Studio such as DeepSeek distilled, Gemma and LLama.


# Getting started
I can recommend LM Studio to run server APIs. Use a decently capable model as `Chat Model` and a fast, easy to run one as `Summary Model`. The latter enables automatic naming of conversations and the suggestion of follow-up topics.

Hint: In the `index.html` is a max-length of 33,000 characters hardcoded. Adjust to your preferences.

---

Project by [Thomas Gorissen](https://github.com/serrynaimo/ai-chat)

Published under MIT License
