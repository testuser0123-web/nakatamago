import { NextRequest, NextResponse } from 'next/server';
import iconv from 'iconv-lite';
import * as cheerio from 'cheerio'; // Import cheerio

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  const { userId } = await params;

  if (!userId) {
    return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
  }

  const targetUrl = `https://www.kyodemo.net/sdemo/b/e_e_liveedge/?bs=hi&k=${userId}`;

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
        'Referer': 'https://www.kyodemo.net/', // Referer to the target domain
        'Accept-Language': 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to fetch user posts from ${targetUrl}: ${response.status} ${response.statusText} - ${errorText}`);
      return NextResponse.json(
        { error: `Failed to fetch user posts: ${response.status} ${response.statusText}` },
        { status: response.status }
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const decodedData = iconv.decode(Buffer.from(arrayBuffer), 'Shift_JIS');

    // Parse HTML with cheerio
    const $ = cheerio.load(decodedData);
    const extractedKeys: string[] = [];

    $('h2 a').each((_idx, el) => {
      const href = $(el).attr('href');
      if (href) {
        // Extract key (sequence of digits) from href
        const match = href.match(/\/(\d+)\//);
        if (match && match[1]) {
          extractedKeys.push(match[1]);
        }
      }
    });

    if (extractedKeys.length === 0) {
      return NextResponse.json({ message: 'このIDの書き込みはまだデータベースに登録されていません。' });
    } else {
      return NextResponse.json({ keys: extractedKeys });
    }

  } catch (error) {
    console.error(`Error fetching user posts for ID ${userId}:`, error);
    return NextResponse.json(
      { error: 'Internal server error while fetching user posts' },
      { status: 500 }
    );
  }
}