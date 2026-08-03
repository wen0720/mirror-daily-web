import '@/shared-styles/topic.css'
import type { Metadata } from 'next'
import { fetchTopicBasicInfo } from '../action'
import {
  getHeroImage,
  selectMainImage,
  // getImageSrc,
  getFirstParagraphFromApiData,
} from '@/utils/data-process'
import { SITE_NAME } from '@/constants/misc'
import { IMAGE_PATH } from '@/constants/default-path'
import { notFound } from 'next/navigation'
import {
  // TOPIC_LEADING,
  TOPIC_LIST_TYPE,
} from '@/types/topic'
// import type { ImageKeys } from '@/utils/data-schema'
// import LeadingVideo from './_components/leading-video'
// import CustomImage from '@/shared-components/custom-image'
// import LeadingSlideshow from './_components/leading-slideshow'
import ListTypeListing from './_components/list-type'
import GroupTypeListing from './_components/group-type'
import { getTopicPageUrl } from '@/utils/site-urls'
import { getDefaultMetadata } from '@/utils/common'
import {
  fetchGroupTypeTopicPostBySlug,
  fetchListTypeTopicPostBySlug,
} from '../action'
import { filterPostsByTag } from '@/utils/topic'

type PageProps = {
  params: { slug: string }
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = params
  const topic = await fetchTopicBasicInfo(slug)

  if (!topic || topic.state !== 'published') {
    notFound()
  }

  const defaultMetadata = getDefaultMetadata()

  const title = `${topic.og_title || topic.name} - ${SITE_NAME}`
  const heroImage = getHeroImage(topic.heroImage)
  const ogImage = getHeroImage(topic.og_image)
  const mainImage = selectMainImage(heroImage, ogImage)
  const image = mainImage.resized?.original || IMAGE_PATH

  let description =
    topic.og_description || getFirstParagraphFromApiData(topic.apiDataBrief)

  if (!description) {
    let posts: { title: string }[] = []

    switch (topic.type) {
      case TOPIC_LIST_TYPE.GROUP: {
        const allPosts = await fetchGroupTypeTopicPostBySlug(slug)
        posts = (topic.tags || [])
          .flatMap((tag) => filterPostsByTag(allPosts, tag))
          .slice(0, 3)
        break
      }
      case TOPIC_LIST_TYPE.LIST:
      default: {
        const { postsData } = await fetchListTypeTopicPostBySlug({
          slug,
          take: 3,
        })
        posts = postsData.slice(0, 3)
        break
      }
    }

    description = posts.map((post) => post.title).join('、') || ''
  }

  const metaData = Object.assign(
    {},
    {
      ...defaultMetadata,
      title,
      description,
      openGraph: {
        ...(defaultMetadata.openGraph ?? {}),
        title,
        description,
        url: getTopicPageUrl(slug),
        images: image,
      },
    }
  )

  return metaData
}

export default async function Page({
  params,
}: PageProps): Promise<JSX.Element> {
  const { slug } = params
  const topic = await fetchTopicBasicInfo(slug)

  if (!topic || topic.state !== 'published') {
    notFound()
  }

  const {
    // leading,
    // heroUrl,
    // heroVideo,
    // heroImage,
    style,
    // slideshow_images,
    // manualOrderOfSlideshowImages,
    type,
    tags,
  } = topic

  // let leadingJsx: React.ReactNode

  // switch (leading) {
  //   case TOPIC_LEADING.VIDEO: {
  //     const pickedSize: ImageKeys[] = ['w1600', 'w1200', 'w800', 'original']
  //     const isExternalVideoSrc = Boolean(heroUrl)

  //     // external video has higher precedence
  //     if (isExternalVideoSrc) {
  //       const poster =
  //         getImageSrc(heroImage?.resizedWebp, pickedSize) ||
  //         getImageSrc(heroImage?.resized, pickedSize) ||
  //         ''

  //       leadingJsx = (
  //         <div className="leading-wrapper">
  //           <LeadingVideo poster={poster} fileUrl={heroUrl!} />
  //         </div>
  //       )
  //     } else {
  //       if (!heroVideo || !heroVideo.videoSrc) {
  //         throw new Error(
  //           `topic page (slug: ${slug}) with leading (${TOPIC_LEADING.VIDEO}) without valid video source`
  //         )
  //       }

  //       const poster =
  //         getImageSrc(heroVideo.heroImage?.resizedWebp, pickedSize) ||
  //         getImageSrc(heroVideo.heroImage?.resized, pickedSize) ||
  //         ''

  //       leadingJsx = (
  //         <div className="leading-wrapper">
  //           <LeadingVideo poster={poster} fileUrl={heroVideo.videoSrc} />
  //         </div>
  //       )
  //     }
  //     break
  //   }
  //   case TOPIC_LEADING.SLIDESHOW: {
  //     if (slideshow_images) {
  //       leadingJsx = (
  //         <div className="leading-wrapper bg-transparent">
  //           <LeadingSlideshow
  //             heroUrl={heroUrl}
  //             list={slideshow_images}
  //             orderList={manualOrderOfSlideshowImages}
  //           />
  //         </div>
  //       )
  //     } else {
  //       leadingJsx = null
  //     }
  //     break
  //   }
  //   case TOPIC_LEADING.IMAGE:
  //   default: {
  //     if (heroImage) {
  //       const images = getHeroImage(heroImage)

  //       if (heroUrl) {
  //         leadingJsx = (
  //           <a target="_blank" href={heroUrl} className="leading-wrapper">
  //             <CustomImage
  //               images={images.resized}
  //               imagesWebP={images.resizedWebp}
  //               objectFit="contain"
  //               alt="topic 首圖"
  //             />
  //           </a>
  //         )
  //       } else {
  //         leadingJsx = (
  //           <div className="leading-wrapper">
  //             <CustomImage
  //               className="leading-image"
  //               images={images.resized}
  //               imagesWebP={images.resizedWebp}
  //               objectFit="contain"
  //               alt="topic 首圖"
  //             />
  //           </div>
  //         )
  //       }
  //     } else {
  //       leadingJsx = null
  //     }
  //     break
  //   }
  // }

  let listingJsx: React.ReactNode

  switch (type) {
    case TOPIC_LIST_TYPE.GROUP: {
      listingJsx = <GroupTypeListing slug={slug} tags={tags || []} />
      break
    }
    case TOPIC_LIST_TYPE.LIST:
    default: {
      listingJsx = <ListTypeListing slug={slug} />
      break
    }
  }

  return (
    <>
      {/* custom styles, use dangerouslySetInnerHTML to prevent hydration error */}
      {style && <style dangerouslySetInnerHTML={{ __html: style }} />}
      <div className="topic">
        {/* 因為該需求先註解掉：https://app.asana.com/1/614399484723017/project/1210077071799813/task/1210066204142622?focus=true */}
        {/* {leadingJsx} */}
        <h1 className="topic-name">{topic.name}</h1>
        <main className="topic-list">{listingJsx}</main>
      </div>
    </>
  )
}
