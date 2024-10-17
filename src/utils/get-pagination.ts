export const getPagination = ({ _page, _limit }) => {
  const page = Number(_page);
  const limit = Number(_limit);
  const skip =
    !isNaN(page) && !isNaN(limit)
      ? Math.abs((page - 1) * Number(limit))
      : undefined;
  const take = limit ? Number(limit) : undefined;

  return {
    skip,
    take,
  };
};
