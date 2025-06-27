import i18next from 'i18next'
import { Docx, docx, Toast } from '@dolphin/lark'
import { generatePublicUrl, makePublicUrlEffective } from '@dolphin/lark/image'
import { isDefined } from '@dolphin/common'
import { CommonTranslationKey, en, Namespace, zh } from '../common/i18n'
import { confirm } from '../common/notification'
import { reportBug } from '../common/issue'

const enum TranslationKey {
  FAILED_TO_LOAD_IMAGES = 'failed_to_load_images',
  UNKNOWN_ERROR = 'unknown_error',
  CONTENT_LOADING = 'content_loading',
  NOT_SUPPORT = 'not_support',
  FAILED_TO_OPEN_WINDOW = 'failed_to_open_window',
}

i18next
  .init({
    lng: docx.language,
    resources: {
      en: {
        translation: {
          [TranslationKey.FAILED_TO_LOAD_IMAGES]: 'Failed to Load images',
          [TranslationKey.UNKNOWN_ERROR]: 'Unknown error during download',
          [TranslationKey.CONTENT_LOADING]:
            'Part of the content is still loading and cannot be copied at the moment. Please wait for loading to complete and retry',
          [TranslationKey.NOT_SUPPORT]:
            'This is not a lark document page and cannot be copied as Markdown',
          [TranslationKey.FAILED_TO_OPEN_WINDOW]:
            'Failed to Open a new window to display markdown.',
        },
        ...en,
      },
      zh: {
        translation: {
          [TranslationKey.FAILED_TO_LOAD_IMAGES]: '加载图片失败',
          [TranslationKey.UNKNOWN_ERROR]: '下载过程中出现未知错误',
          [TranslationKey.CONTENT_LOADING]:
            '部分内容仍在加载中，暂时无法复制。请等待加载完成后重试',
          [TranslationKey.NOT_SUPPORT]:
            '这不是一个飞书文档页面，无法复制为 Markdown',
          [TranslationKey.FAILED_TO_OPEN_WINDOW]:
            '无法打开新窗口以显示 Markdown',
        },
        ...zh,
      },
    },
  })
  .catch(console.error)

const main = async () => {
  if (!docx.rootBlock) {
    Toast.warning({ content: i18next.t(TranslationKey.NOT_SUPPORT) })
    return
  }

  if (!docx.isReady()) {
    Toast.warning({
      content: i18next.t(TranslationKey.CONTENT_LOADING),
    })
    return
  }

  const { root, images } = docx.intoMarkdownAST()

  const tokens = images
    .map(image => {
      if (!image.data?.token) return null

      const { token } = image.data
      const publicUrl = generatePublicUrl(token)
      const code = new URL(publicUrl).searchParams.get('code')
      if (!code) return null

      image.url = publicUrl
      return [token, code]
    })
    .filter(isDefined)

  const markdown = Docx.stringify(root)

  if (!window.document.hasFocus()) {
    const confirmed = await confirm()
    if (!confirmed) {
      return
    }
  }

  const previewWindow = window.open('', '_blank', 'width=800,height=600')

  if (!previewWindow) {
    console.error('Failed to open new window.')
    return
  }

  previewWindow.document.title = 'Markdown Preview'

  // prepare markdown preview for document
  const writeViewContent = () => {
    const doc = previewWindow.document

    const style = doc.createElement('style')
    style.textContent = `
    body {
      font-family: monospace, system-ui, sans-serif;
      padding: 20px;
      background: #f9f9f9;
      color: #222;
    }
    pre {
      white-space: pre-wrap;
      word-break: break-word;
      background: #fff;
      padding: 1em;
      border: 1px solid #ddd;
      border-radius: 6px;
    }
    `
    doc.head.appendChild(style)

    const heading = doc.createElement('h2')
    heading.textContent = 'Markdown Preview'
    doc.body.appendChild(heading)

    const pre = doc.createElement('pre')
    pre.textContent = markdown // Safe, no need to escape
    doc.body.appendChild(pre)
  }

  if (
    previewWindow.document.readyState === 'complete' ||
    document.readyState === 'interactive'
  ) {
    writeViewContent()
  } else {
    previewWindow.onload = () => {
      writeViewContent()
    }
  }

  if (tokens.length > 0) {
    const isSuccess = await makePublicUrlEffective(
      Object.fromEntries(tokens) as Record<string, string>,
    )
    if (!isSuccess) {
      Toast.error({
        content: i18next.t(TranslationKey.FAILED_TO_LOAD_IMAGES),
      })
    }
  }
}

main().catch((error: unknown) => {
  Toast.error({
    content: i18next.t(TranslationKey.UNKNOWN_ERROR),
    actionText: i18next.t(CommonTranslationKey.CONFIRM_REPORT_BUG, {
      ns: Namespace.COMMON,
    }),
    onActionClick: () => {
      reportBug(error)
    },
  })
})
