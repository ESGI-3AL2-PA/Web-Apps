// AppError / NotFoundError / errorHandler are shared — see @repo/shared. Re-exported
// here (single class identity across both backends) so local import paths stay stable.
export { AppError, NotFoundError, errorHandler } from "@repo/shared";
