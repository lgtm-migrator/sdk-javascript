const {
    SpecificationsSearchResult,
  } = require("../../../src/core/searchResult/Specifications"),
  sinon = require("sinon"),
  should = require("should");

describe("SpecificationsSearchResult", () => {
  const options = { opt: "in" };

  let kuzzle, request, result, searchResult;

  beforeEach(() => {
    kuzzle = {
      query: sinon.stub().resolves(),
    };

    request = {
      body: { query: { foo: "bar" } },
      controller: "collection",
      action: "searchSpecifications",
    };
  });

  describe("constructor", () => {
    it("should create a SpecificationsSearchResult instance with good properties", () => {
      result = {
        hits: [
          {
            _id: "index#collection1",
            _score: 0.9876,
            _source: { index: "index", collection: "collection1" },
          },
          {
            _id: "index#collection2",
            _score: 0.6789,
            _source: { index: "index", collection: "collection2" },
          },
        ],
        total: 3,
      };

      searchResult = new SpecificationsSearchResult(
        kuzzle,
        request,
        options,
        result
      );

      should(searchResult._request).be.equal(request);
      should(searchResult._options).be.equal(options);
      should(searchResult._result).be.equal(result);

      should(searchResult.hits).be.equal(result.hits);
      should(searchResult.fetched).be.equal(2);
      should(searchResult.total).be.equal(3);

      should(searchResult._controller).be.equal("collection");
      should(searchResult._searchAction).be.equal("searchSpecifications");
      should(searchResult._scrollAction).be.equal("scrollSpecifications");
    });
  });

  describe("next", () => {
    it("should resolve null without calling kuzzle query if all results are already fetched", () => {
      result = {
        scrollId: "scroll-id",
        hits: [
          {
            _id: "index#collection1",
            _score: 0.9876,
            _source: { index: "index", collection: "collection1" },
          },
          {
            _id: "index#collection2",
            _score: 0.6789,
            _source: { index: "index", collection: "collection2" },
          },
        ],
        total: 2,
      };

      searchResult = new SpecificationsSearchResult(
        kuzzle,
        request,
        options,
        result
      );

      return searchResult.next().then((res) => {
        should(kuzzle.query).not.be.called();
        should(res).be.Null();
      });
    });

    it("should reject with an error if neither scroll, nor size/sort, nor size/from parameters are set", () => {
      result = {
        scrollId: "scroll-id",
        hits: [
          {
            _id: "index#collection1",
            _score: 0.9876,
            _source: { index: "index", collection: "collection1" },
          },
          {
            _id: "index#collection2",
            _score: 0.6789,
            _source: { index: "index", collection: "collection2" },
          },
        ],
        total: 30,
      };

      searchResult = new SpecificationsSearchResult(
        kuzzle,
        request,
        options,
        result
      );

      return should(searchResult.next()).be.rejectedWith(
        "Unable to retrieve next results from search: missing scrollId, from/sort, or from/size params"
      );
    });

    describe("#with scroll option", () => {
      const nextResponse = {
        scrollId: "scroll-id",
        hits: [
          {
            _id: "index#collection3",
            _score: 0.6543,
            _source: { index: "index", collection: "collection3" },
          },
          {
            _id: "index#collection4",
            _score: 0.6123,
            _source: { index: "index", collection: "collection4" },
          },
        ],
        total: 30,
      };

      beforeEach(() => {
        request.scroll = "10s";

        result = {
          scrollId: "scroll-id",
          hits: [
            {
              _id: "index#collection1",
              _score: 0.9876,
              _source: { index: "index", collection: "collection1" },
            },
            {
              _id: "index#collection2",
              _score: 0.6789,
              _source: { index: "index", collection: "collection2" },
            },
          ],
          total: 30,
        };
        searchResult = new SpecificationsSearchResult(
          kuzzle,
          request,
          options,
          result
        );

        kuzzle.query.resolves({ result: nextResponse });
      });

      it("should call collection/scrollSpecifications action with scrollId parameter and resolve to a new SpecificationSearchResult", () => {
        return searchResult.next().then((nextSearchResult) => {
          should(kuzzle.query).be.calledOnce().be.calledWith({
            controller: "collection",
            action: "scrollSpecifications",
            scroll: "10s",
            scrollId: "scroll-id",
          });
          should(nextSearchResult).not.be.equal(searchResult);
          should(nextSearchResult).be.instanceOf(SpecificationsSearchResult);
        });
      });

      it('should set the result and increment the "fetched" property', () => {
        should(searchResult.fetched).be.equal(2);
        should(searchResult._result).be.equal(result);
        return searchResult.next().then((nextSearchResult) => {
          should(nextSearchResult.fetched).be.equal(4);
          should(nextSearchResult._result).be.equal(nextResponse);
          should(nextSearchResult.hits).be.equal(nextResponse.hits);
        });
      });
    });

    describe("#with size and sort option", () => {
      const nextResponse = {
        hits: [
          {
            _id: "index#collection3",
            _score: 0.6543,
            _source: { index: "index", collection: "collection3" },
          },
          {
            _id: "index#collection4",
            _score: 0.6123,
            _source: { index: "index", collection: "collection4" },
          },
        ],
        total: 30,
      };

      beforeEach(() => {
        request.size = 2;
        request.body.sort = ["index", { collection: "asc" }];

        result = {
          hits: [
            {
              _id: "index#collection1",
              _score: 0.9876,
              _source: { index: "index", collection: "collection1" },
            },
            {
              _id: "index#collection2",
              _score: 0.6789,
              _source: { index: "index", collection: "collection2" },
            },
          ],
          total: 30,
        };
        searchResult = new SpecificationsSearchResult(
          kuzzle,
          request,
          options,
          result
        );

        kuzzle.query.resolves({ result: nextResponse });
      });

      it("should call collection/searchSpecifications action with search_after parameter and resolve to a new SpecificationSearchResult", () => {
        return searchResult.next().then((nextSearchResult) => {
          should(kuzzle.query)
            .be.calledOnce()
            .be.calledWith(
              {
                body: {
                  query: { foo: "bar" },
                  sort: ["index", { collection: "asc" }],
                  search_after: ["index", "collection2"],
                },
                controller: "collection",
                action: "searchSpecifications",
                size: 2,
              },
              options
            );
          should(nextSearchResult).not.be.equal(searchResult);
          should(nextSearchResult).be.instanceOf(SpecificationsSearchResult);
        });
      });

      it('should set the result and increment the "fetched" property', () => {
        should(searchResult.fetched).be.equal(2);
        should(searchResult._result).be.equal(result);
        return searchResult.next().then((nextSearchResult) => {
          should(nextSearchResult.fetched).be.equal(4);
          should(nextSearchResult._result).be.equal(nextResponse);
          should(nextSearchResult.hits).be.equal(nextResponse.hits);
        });
      });
    });

    describe("#with from and size option", () => {
      const nextResponse = {
        hits: [
          {
            _id: "index#collection3",
            _score: 0.6543,
            _source: { index: "index", collection: "collection3" },
          },
          {
            _id: "index#collection4",
            _score: 0.6123,
            _source: { index: "index", collection: "collection4" },
          },
        ],
        total: 30,
      };

      beforeEach(() => {
        request.size = 2;
        request.from = 2;

        result = {
          hits: [
            {
              _id: "index#collection1",
              _score: 0.9876,
              _source: { index: "index", collection: "collection1" },
            },
            {
              _id: "index#collection2",
              _score: 0.6789,
              _source: { index: "index", collection: "collection2" },
            },
          ],
          total: 30,
        };
        searchResult = new SpecificationsSearchResult(
          kuzzle,
          request,
          options,
          result
        );

        kuzzle.query.resolves({ result: nextResponse });
      });

      it("should resolve null without calling kuzzle query if from parameter is greater than the search count", () => {
        request.from = 30;

        return searchResult.next().then((res) => {
          should(kuzzle.query).not.be.called();
          should(res).be.Null();
        });
      });

      it("should call collection/searchSpecifications action with from/size parameters and resolve to a new SpecificationSearchResult", () => {
        return searchResult.next().then((nextSearchResult) => {
          should(kuzzle.query)
            .be.calledOnce()
            .be.calledWith(
              {
                body: { query: { foo: "bar" } },
                controller: "collection",
                action: "searchSpecifications",
                size: 2,
                from: 2,
              },
              options
            );
          should(nextSearchResult).not.be.equal(searchResult);
          should(nextSearchResult).be.instanceOf(SpecificationsSearchResult);
        });
      });

      it('should set the result and increment the "fetched" property', () => {
        should(searchResult.fetched).be.equal(2);
        should(searchResult._result).be.equal(result);
        return searchResult.next().then((nextSearchResult) => {
          should(nextSearchResult.fetched).be.equal(4);
          should(nextSearchResult._result).be.equal(nextResponse);
          should(nextSearchResult.hits).be.equal(nextResponse.hits);
        });
      });
    });
  });
});
