import { find } from 'linkifyjs'
import { escapeHTML, sanitizeHTML } from '@/utils'

// Links are lifted out before the markup rules run, which would otherwise read a URL's underscores as italics.
const LINK_SLOT = /(\d+)/g

export function formatWhatsAppMessage(message) {
  // A caption-less image has a null body, and this runs inside render, where a throw blanks the whole thread.
  if (!message) return ''

  const links = find(message, 'url')
  let slotted = ''
  let at = 0
  links.forEach((link, i) => {
    slotted += `${message.slice(at, link.start)}${i}`
    at = link.end
  })
  message = slotted + message.slice(at)

  // if message contains _text_, make it italic
  message = message.replace(/_(.*?)_/g, '<i>$1</i>')
  // if message contains *text*, make it bold
  message = message.replace(/\*(.*?)\*/g, '<b>$1</b>')
  // if message contains ~text~, make it strikethrough
  message = message.replace(/~(.*?)~/g, '<s>$1</s>')
  // if message contains ```text```, make it monospace
  message = message.replace(/```(.*?)```/g, '<code>$1</code>')
  // if message contains `text`, make it inline code
  message = message.replace(/`(.*?)`/g, '<code>$1</code>')
  // if message contains > text, make it a blockquote
  message = message.replace(/^> (.*)$/gm, '<blockquote>$1</blockquote>')
  // if contain /n, make it a new line
  message = message.replace(/\n/g, '<br>')
  // if contains *<space>text, make it a bullet point
  message = message.replace(/\* (.*?)(?=\s*\*|$)/g, '<li>$1</li>')
  message = message.replace(/- (.*?)(?=\s*-|$)/g, '<li>$1</li>')
  message = message.replace(/(\d+)\. (.*?)(?=\s*(\d+)\.|$)/g, '<li>$2</li>')

  message = message.replace(LINK_SLOT, (_, i) => {
    const { href, value } = links[i]
    return `<a href="${escapeHTML(href)}" target="_blank" rel="noopener noreferrer">${escapeHTML(value)}</a>`
  })
  return sanitizeHTML(message, { ADD_ATTR: ['target'] })
}
