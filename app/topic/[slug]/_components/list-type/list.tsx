'use client'

import InfiniteScrollList from '@readr-media/react-infinite-scroll-list'
import { useCallback, useRef } from 'react'
import ArticleCard from '../article-card'
import type { PostData } from '@/utils/data-process'

type Props = {
  pageSize: number
  totalAmount: number
  initialList: PostData[]
  fetchMoreItem(fileNum: number, skip: number): Promise<PostData[]>
}

export default function List({
  pageSize,
  totalAmount,
  initialList,
  fetchMoreItem,
}: Props) {
  /**
   * 已取回的文章總數。
   * 一次載入的筆數由靜態 JSON 的切檔大小決定，不等於 pageSize，
   * 因此改由此處記錄游標，供靜態資料源失效、改走 GraphQL 時對齊取用範圍。
   */
  const fetchedAmount = useRef(initialList.length)

  const fetchListInPage = useCallback(
    async (page: number) => {
      // 首屏已取用第 1 份 JSON，之後每次載入更多剛好消化一份，故 page 即為檔案編號
      const postsData = await fetchMoreItem(page, fetchedAmount.current)
      fetchedAmount.current += postsData.length

      return postsData
    },
    [fetchMoreItem]
  )

  return (
    <div className="list-container with-loadmore">
      <InfiniteScrollList
        initialList={initialList}
        pageSize={pageSize}
        amountOfElements={totalAmount}
        fetchListInPage={fetchListInPage}
        isAutoFetch={false}
        loader={<button className="load-more">看更多</button>}
      >
        {(posts) =>
          posts.map((post) => <ArticleCard key={post.id} {...post} />)
        }
      </InfiniteScrollList>
    </div>
  )
}
