
/**
 * 解析 URL Hash 参数
 */
const parseHashParams = () => {
    const hashParams = {}
    const hash = window.location.hash.substring(1) // remove the #
    const params = hash.split('&')
    params.forEach(param => {
        const [key, value] = param.split('=')
        hashParams[decodeURIComponent(key)] = decodeURIComponent(value)
    })
    return hashParams
}

// 调用 OpenAI API 完成聊天
const chatCompletion = (apiKey, data) => {
    const endpoint = 'https://api.openai.com/v1/chat/completions'
    data.model = "gpt-3.5-turbo"


    var temprature=localStorage.getItem(`temperature`)
    var max_tokens=localStorage.getItem(`max_tokens`)

    if(temprature!='')
        data.temperature=temprature

    if(max_tokens!='')
        data.max_tokens=max_tokens


    return fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(data)
    })
        .then(response => response.json())
        .catch(error => {
            console.error('Error:', error)
        })
}

// 隐藏开始页面
const hideStartView = () => {
    document.querySelector('#start-view').classList.add('hidden')
}

// 显示开始页面
const showStartView = () => {
    document.querySelector('#start-view').classList.remove('hidden')
}

// 设置 API 密钥输入框
const setupAPIKeyInput = () => {
    const element = document.querySelector('#api-key')
    const savedAPIKey = localStorage.getItem('api-key') || ''
    element.value = savedAPIKey
    element.addEventListener('input', () => {
        const key = element.value
        console.log('saving:', key)
        localStorage.setItem('api-key', key)
        if (key) {
            hideStartView()
        } else {
            showStartView()
        }
    })

    if (savedAPIKey) {
        hideStartView()
    }
}

// 渲染 Markdown
const renderMarkdown = md => {
    return DOMPurify.sanitize(marked.parse(md, {
        gfm: true
    }))
}

// 添加消息
const addMessage = (message, type) => {
    const element = document.querySelector('#output')

    const messageContainer = document.createElement('div')
    messageContainer.classList.add(`${type}-container`)
    element.appendChild(messageContainer)

    const messageBubble = document.createElement('div')
    messageBubble.classList.add(`${type}-bubble`)
    messageBubble.classList.add('message-bubble')
    messageBubble.innerHTML = renderMarkdown(message)
    messageContainer.appendChild(messageBubble)

    const copiedIndicator = document.createElement('span')
    copiedIndicator.classList.add('copied-indicator')
    messageContainer.appendChild(copiedIndicator)

    messageBubble.addEventListener('click', () => {
        navigator.clipboard.writeText(message)
        .then(() => {
            copiedIndicator.innerText = 'Copied!'
        })
        .catch((error) => {
            alert('Error copying text to clipboard:', error)
        })
    })

    window.addEventListener('click', () => {
        const oldCopiedIndicators = document.querySelectorAll('.copied-indicator')
        for (const indicator of oldCopiedIndicators) {
            indicator.innerText = ''
        }
    })

    return messageContainer
}

// 添加我发送的消息
const addSentMessage = message => {
    return addMessage(message, 'my-message')
}

// 添加聊天机器人收到的消息
const addReceivedMessage = message => {
    return addMessage(message, 'response')
}

// 添加错误消息
const addErrorMessage = (message, type) => {
    const element = document.querySelector('#output')

    const messageContainer = document.createElement('div')
    messageContainer.classList.add(`${type}-container`)
    messageContainer.classList.add('error')
    element.appendChild(messageContainer)

    messageContainer.innerText = message

    return messageContainer
}

// 平滑滚动
const smoothScroll = (targetPosition, duration) => {
    const currentPosition = window.pageYOffset
    const distance = targetPosition - currentPosition
    const startTime = performance.now()

    const easeInOutQuad = (t, b, c, d) => {
        t /= d / 2
        if (t < 1) return (c / 2) * t * t + b
        t--
        return (-c / 2) * (t * (t - 2) - 1) + b
    }

    const animationCallback = (time) => {
        const elapsedTime = time - startTime
        const scroll = easeInOutQuad(elapsedTime, currentPosition, distance, duration)
        window.scrollTo(0, scroll)
        if (elapsedTime < duration) requestAnimationFrame(animationCallback)
    }

    requestAnimationFrame(animationCallback)
}

// 判断是否滚动到底部
const isScrolledToBottom = () => {
    const { scrollTop, clientHeight, scrollHeight } = document.documentElement
    return scrollTop + clientHeight >= scrollHeight
}

// 更新文本框大小
const updateTextareaSize = (element) => {
    element.style.height = 0

    const style = window.getComputedStyle(element)
    const paddingTop = parseFloat(style.getPropertyValue('padding-top'))
    const paddingBottom = parseFloat(style.getPropertyValue('padding-bottom'))

    const height = element.scrollHeight - paddingTop - paddingBottom

    element.style.height = `${height}px`
}

window.addEventListener('load', () => {
    setupAPIKeyInput()

    let messages = [
        {
            "role": "system",
            "content": "Response format is ALWAYS markdown, especially for code."
        }
    ]

    const sendMessage = (message) => {
        addSentMessage(message)
        // scroll down always after sending message, even if wasn't before
        smoothScroll(document.body.scrollHeight, 500)

        const dot = '&#x25CF;'
        const typingIndicatorElement = addReceivedMessage(`${dot} ${dot} ${dot}`)

        messages.push({
            'role': 'user',
            'content': message
        })

        const apiKey = localStorage.getItem('api-key')

        const response = chatCompletion(apiKey, {
            messages
        })

        response.then(message => {
            typingIndicatorElement.remove()
            const wasScrolledToBottom = isScrolledToBottom()

            if ('error' in message) {
                addErrorMessage(message.error.message, 'assistant')

            } else if ('choices' in message) {
                message = message.choices[0].message
                messages.push(message)
                addReceivedMessage(message.content)
            }

            if (wasScrolledToBottom) smoothScroll(document.body.scrollHeight, 500)
        })
    }

    const hashParams = parseHashParams()
    if ('q' in hashParams && hashParams.q) {
        sendMessage(hashParams.q)
    }

    const submitMessageForm = () => {
        const input = document.querySelector('#prompt').value
        document.querySelector('#prompt').value = ''
        sendMessage(input)
    }


    const textbox = document.querySelector('#prompt')

    textbox.addEventListener('keydown', (event) => {
        if (event.key=='Enter' && !event.ctrlKey && !event.altKey && !event.shiftKey) {
            event.preventDefault()
            submitMessageForm()
            updateTextareaSize(textbox)
        }

    })

    document.querySelector('form').addEventListener('submit', (event) => {
        event.preventDefault()
        submitMessageForm()
        updateTextareaSize(textbox)
    })

    textbox.addEventListener("input", () => {
        updateTextareaSize(textbox)
    })
    updateTextareaSize(textbox)

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/service-worker.js').then(function(registration) {
            console.log('ServiceWorker registration successful with scope: ', registration.scope)
        }, (error) => {
            console.log('ServiceWorker registration failed: ', error)
        })
    }
})