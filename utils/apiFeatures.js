export class ApiFeatures {
  constructor(query, queryString) {
    this.query = query;
    this.queryString = queryString;
  }

  search() {
    if (this.queryString.search) {
      const keyword = {
        $or: [
          { profession: { $regex: this.queryString.search, $options: "i" } },
          { education: { $regex: this.queryString.search, $options: "i" } },
          { bio: { $regex: this.queryString.search, $options: "i" } },
          { "location.city": { $regex: this.queryString.search, $options: "i" } },
          { "location.country": { $regex: this.queryString.search, $options: "i" } },
        ],
      };

      this.query = this.query.find(keyword);
    }
    return this;
  }

  filter() {
    const queryCopy = { ...this.queryString };
    const removeFields = ["page", "limit", "sort", "search"];
    removeFields.forEach((key) => delete queryCopy[key]);

    let queryStr = JSON.stringify(queryCopy);
    queryStr = queryStr.replace(
      /\b(gte|gt|lte|lt)\b/g,
      (key) => `$${key}`
    );

    this.query = this.query.find(JSON.parse(queryStr));
    return this;
  }

  sort() {
    if (this.queryString.sort) {
      const sortBy = this.queryString.sort.split(",").join(" ");
      this.query = this.query.sort(sortBy);
    } else {
      this.query = this.query.sort("-createdAt");
    }
    return this;
  }

  paginate() {
    const page = Number(this.queryString.page) || 1;
    const limit = Number(this.queryString.limit) || 10;
    const skip = (page - 1) * limit;

    this.query = this.query.skip(skip).limit(limit);
    return this;
  }
}
