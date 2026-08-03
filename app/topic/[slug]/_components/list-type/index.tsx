import { notFound } from 'next/navigation'
import { fetchListTypeTopicPostBySlug } from '../../../action'
import List from './list'
import { PAGE_SIZE } from '@/constants/topic'
import { SITE_URL } from '@/constants/config'
import { IMAGE_PATH } from '@/constants/default-path'
import type { PostData } from '@/utils/data-process'

type Props = {
  slug: string
}

export default async function ListTypeListing({ slug }: Props) {
  const { postsData: initialPosts, postsCount } =
    await fetchListTypeTopicPostBySlug({
      slug,
      take: PAGE_SIZE,
      page: 1,
      withAmount: true,
    })

  if (postsCount === 0) notFound()

  const fetchMorePosts = async (page: number) => {
    'use server'
    const globalStart = (page - 1) * PAGE_SIZE
    const globalEnd = page * PAGE_SIZE

    // 每個 JSON 檔的實際筆數不固定，動態累積直到取得足夠的資料
    const accumulated: PostData[] = []
    let fileNum = 1

    while (accumulated.length < globalEnd) {
      const { postsData } = await fetchListTypeTopicPostBySlug({
        slug,
        take: 0,
        page: fileNum,
      })
      if (postsData.length === 0) break
      accumulated.push(...postsData)
      fileNum++
    }

    return accumulated.slice(globalStart, globalEnd)
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: initialPosts.map((post, index) => {
      let imageUrl: string | undefined
      if (typeof post.postMainImage === 'string') {
        imageUrl = post.postMainImage
      } else {
        imageUrl = post.postMainImage.resized?.original
      }
      return {
        '@type': 'ListItem',
        position: index + 1,
        item: {
          '@type': 'NewsArticle',
          name: post.title,
          image: imageUrl || `${SITE_URL}${IMAGE_PATH}`,
          dateCreated: new Date(post.formattedDate).toISOString(),
          description: post.brief,
          url: `${SITE_URL}${post.link}`,
        },
      }
    }),
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
        }}
      />
      <List
        pageSize={PAGE_SIZE}
        totalAmount={postsCount}
        initialList={initialPosts}
        fetchMoreItem={fetchMorePosts}
      />
    </>
  )
}
