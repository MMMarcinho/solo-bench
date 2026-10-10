import dayjs from 'dayjs';

export function formatDate(
  date: number | string,
  opts?: {
    short?: boolean;
  },
) {
  if (date === undefined || date === null || date === '') return '';

  const mom = dayjs(Number.isNaN(+date) ? date : +date);

  // dayjs 包裹非法时间时，toISOString() 会抛 RangeError，需要兜底。
  if (!mom.isValid()) return '';

  const now = new Date();
  const { short } = opts || {};

  // 今日
  if (mom.isSame(now, 'day')) {
    return mom.format(short ? 'HH:mm' : 'HH:mm:ss');
  } else if (mom.isSame(now, 'year')) {
    return mom.format(short ? 'M-D HH:mm' : 'M月D日 HH:mm:ss');
  }

  return mom.format(short ? 'YYYY-M-D HH:mm' : 'YYYY年M月D日 HH:mm:ss');
}
