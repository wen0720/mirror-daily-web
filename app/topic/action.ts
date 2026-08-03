'use server'

import { createErrorLogger, getTraceObject } from '@/utils/log/common'
import { fetchGQLData } from '@/utils/graphql'
import type {
  GetGroupTypeTopicPostsQuery,
  GetTopicBasicInfoQuery,
  GetTopicListQuery,
} from '@/graphql/__generated__/graphql'
import {
  GetGroupTypeTopicPostsDocument,
  GetListTypeTopcPostsDocument,
  GetTopicBasicInfoDocument,
  GetTopicListDocument,
} from '@/graphql/__generated__/graphql'
import {
  createDataFetchingChain,
  getFirstParagraphFromApiData,
  getHeroImage,
  transformRawPost,
  selectMainImage,
  removeHtmlTags,
  type PostData,
} from '@/utils/data-process'
import type { PostDataWithTags, Topic } from '@/types/topic'
import { getStoryPageUrl, getExternalPageUrl } from '@/utils/site-urls'
import { STATIC_JSON_TOPIC_NEWS } from '@/constants/config'
import {
  sectionPostSchema,
  countsSchema,
  topicPostSchema,
} from '@/utils/data-schema'
import { z } from 'zod'
import { readStaticJson } from '@/utils/read-static-json'

async function fetchTopicBasicInfo(
  slug: string
): Promise<GetTopicBasicInfoQuery['topic']> {
  const errorLogger = createErrorLogger(
    `Error occurs while fetching topic basic info (slug: ${slug})`,
    getTraceObject()
  )

  const result = await fetchGQLData(errorLogger, GetTopicBasicInfoDocument, {
    slug,
  })

  if (result) {
    const { topic } = result
    return topic
  } else {
    return null
  }
}

/**
 * 取得專題文章。
 *
 * 靜態 JSON 以 `fileNum` 指定第幾份檔案，並整份回傳；
 * 每份檔案的筆數與 UI 分頁的 PAGE_SIZE 不同，多出來的部分交由呼叫端暫存後續渲染，
 * 藉此避免把「檔案編號」與「UI 頁碼」視為同一件事而導致分頁錯位。
 *
 * `take` / `skip` 只在靜態資料源失效、改走 GraphQL 時使用，皆為全域文章序。
 */
async function fetchListTypeTopicPostBySlug({
  slug,
  take,
  fileNum = 1,
  skip = 0,
  withAmount = false,
}: {
  slug: string
  take: number
  fileNum?: number
  skip?: number
  withAmount?: boolean
}) {
  const errorLogger = createErrorLogger(
    `Error occurs while fetching list type topic posts (slug: ${slug})`,
    getTraceObject()
  )

  const data = await createDataFetchingChain<{
    postsData: PostData[]
    postsCount: number
  }>(
    errorLogger,
    {
      postsData: [],
      postsCount: 0,
    },
    async () => {
      const rawData = await readStaticJson<{ topic?: unknown }>(
        `${STATIC_JSON_TOPIC_NEWS}_${slug}_${fileNum}.json`
      )

      const schema = z.object({
        items: z.array(sectionPostSchema),
        counts: countsSchema,
      })

      const result = schema.parse(rawData?.topic)

      const postsData = result.items.map(transformRawPost)
      const postsCount = result.counts.posts + result.counts.externals

      return {
        postsData,
        postsCount,
      }
    },
    async () => {
      const rawData = await fetchGQLData(
        errorLogger,
        GetListTypeTopcPostsDocument,
        {
          slug,
          take,
          skip,
          withAmount,
        }
      )
      if (rawData && rawData.topic && Array.isArray(rawData.topic.posts)) {
        const postsData = rawData.topic.posts.map(transformRawPost)
        if (typeof rawData.topic.postsCount === 'number') {
          return {
            postsData,
            postsCount: rawData.topic.postsCount,
          }
        } else {
          return {
            postsData,
            postsCount: 0,
          }
        }
      } else {
        return {
          postsData: [],
          postsCount: 0,
        }
      }
    }
  )
  return data
}

type RawPostWithTags = NonNullable<
  NonNullable<GetGroupTypeTopicPostsQuery['topic']>['posts']
>[0]

const transformRawPostWithTags = (
  rawPost: RawPostWithTags | z.infer<typeof topicPostSchema>
): PostDataWithTags => {
  const isPostFromGQL = '__typename' in rawPost && rawPost.__typename === 'Post'
  const isPostFromJSON = 'type' in rawPost && rawPost.type === 'story'
  const isExternalFromJSON = 'type' in rawPost && rawPost.type === 'external'

  const id = rawPost.id
  const title = rawPost.title ?? ''

  if (isPostFromGQL || isPostFromJSON) {
    const link = getStoryPageUrl(id)
    const heroImage = getHeroImage(rawPost.heroImage)
    const ogImage = getHeroImage(rawPost.og_image)
    const content = getFirstParagraphFromApiData(rawPost.apiData) ?? ''
    const brief = getFirstParagraphFromApiData(rawPost.apiDataBrief) ?? ''
    const textContent = removeHtmlTags(brief || content)
    const postMainImage = selectMainImage(heroImage, ogImage)
    const tags = rawPost.tags ?? []

    return {
      id,
      title,
      link,
      textContent,
      postMainImage,
      tags,
    }
  } else if (isExternalFromJSON) {
    const link = getExternalPageUrl(id)
    const brief = rawPost.brief
    const content = rawPost.content
    const textContent = removeHtmlTags(brief || content)
    const postMainImage = rawPost.thumb
    const tags = rawPost.tags ?? []

    return {
      id,
      title,
      link,
      textContent,
      postMainImage,
      tags,
    }
  } else {
    throw new Error(`unexpected raw topic post type , post id:${id}`)
  }
}

async function fetchGroupTypeTopicPostBySlug(
  slug: string
): Promise<PostDataWithTags[]> {
  const errorLogger = createErrorLogger(
    `Error occurs while fetching group type topic posts (slug: ${slug})`,
    getTraceObject()
  )

  const data = await createDataFetchingChain<PostDataWithTags[]>(
    errorLogger,
    [],
    async () => {
      const firstPageData = await readStaticJson<{ topic?: unknown }>(
        `${STATIC_JSON_TOPIC_NEWS}_${slug}_1.json`
      )

      const schema = z.object({
        items: z.array(topicPostSchema),
        counts: countsSchema,
      })

      const firstPageResult = schema.parse(firstPageData?.topic)

      const totalPosts =
        firstPageResult.counts.posts + firstPageResult.counts.externals

      const totalPages = Math.ceil(totalPosts / 24)

      const allPosts: PostDataWithTags[] = []

      const firstPagePosts = firstPageResult.items.map(transformRawPostWithTags)

      allPosts.push(...firstPagePosts)

      for (let page = 2; page <= totalPages; page++) {
        const rawData = await readStaticJson<{ topic?: unknown }>(
          `${STATIC_JSON_TOPIC_NEWS}_${slug}_${page}.json`
        )

        const result = schema.parse(rawData?.topic)

        const pagePosts = result.items.map(transformRawPostWithTags)

        allPosts.push(...pagePosts)
      }

      return allPosts
    },
    async () => {
      const rawData = await fetchGQLData(
        errorLogger,
        GetGroupTypeTopicPostsDocument,
        {
          slug,
        }
      )
      if (rawData && rawData.topic && Array.isArray(rawData.topic.posts)) {
        return rawData.topic.posts.map(transformRawPostWithTags)
      } else {
        return []
      }
    }
  )

  return data
}

type RawTopic = NonNullable<GetTopicListQuery['topics']>[number]

const transformRawTopic = (rawTopic: RawTopic): Topic => {
  const id = rawTopic.id
  const name = rawTopic.name ?? ''
  const slug = rawTopic.slug ?? ''
  const brief = getFirstParagraphFromApiData(rawTopic.apiDataBrief) ?? ''
  const heroImage = getHeroImage(rawTopic.heroImage)

  return {
    id,
    name,
    slug,
    brief,
    heroImage,
  }
}

async function fetchTopicListingByPage({
  take,
  skip = 0,
  withAmount = false,
}: {
  take: number
  skip: number
  withAmount?: boolean
}): Promise<{
  items: Topic[]
  totalAmount?: number
}> {
  const errorLogger = createErrorLogger(
    `Error occurs while fetching topic listing`,
    getTraceObject()
  )

  const result = await fetchGQLData(errorLogger, GetTopicListDocument, {
    skip,
    take,
    withAmount,
  })

  if (result && Array.isArray(result.topics)) {
    const items = result.topics.map(transformRawTopic)
    if (typeof result.topicsCount === 'number') {
      return {
        items,
        totalAmount: result.topicsCount,
      }
    } else {
      return {
        items,
      }
    }
  } else {
    return {
      items: [],
      totalAmount: 0,
    }
  }
}

export {
  fetchTopicBasicInfo,
  fetchListTypeTopicPostBySlug,
  fetchGroupTypeTopicPostBySlug,
  fetchTopicListingByPage,
}
