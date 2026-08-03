import { notFound } from 'next/navigation'
import { fetchListTypeTopicPostBySlug } from '../../../action'
import List from './list'
import { PAGE_SIZE } from '@/constants/topic'
import { SITE_URL } from '@/constants/config'
import { IMAGE_PATH } from '@/constants/default-path'

type Props = {
  slug: string
}

export default async function ListTypeListing({ slug }: Props) {
  const { postsData: initialPosts, postsCount } =
    await fetchListTypeTopicPostBySlug({
      slug,
      take: PAGE_SIZE,
      fileNum: 1,
      withAmount: true,
    })

  if (postsCount === 0) notFound()

  const fetchMorePosts = async (fileNum: number, skip: number) => {
    'use server'
    if (!Number.isInteger(fileNum) || fileNum < 2) return []

    const { postsData } = await fetchListTypeTopicPostBySlug({
      slug,
      take: PAGE_SIZE,
      fileNum,
      skip,
    })

    console.log('postsData', postsData)

    return postsData
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
