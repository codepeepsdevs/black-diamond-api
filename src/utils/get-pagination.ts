export const getPagination = ({ _page, _limit }) => {
  const page = parseInt(_page);
  const limit = parseInt(_limit);
  const skip =
    !isNaN(page) && !isNaN(limit) ? Math.abs((page - 1) * limit) : undefined;
  const take = limit ? limit : undefined;

  return {
    skip,
    take,
  };
};
