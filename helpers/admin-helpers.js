var db = require("../config/connection");
var collection = require("../config/collections");
const collections = require("../config/collections");
const { category } = require("../config/collections");
var objectId = require("mongodb").ObjectId;
// const bcrypt = require('bcrypt');

module.exports = {
    adminLogin: (adminData) => {
        console.log(adminData);
        return new Promise(async (resolve, reject) => {
            let response = {};
            let admin = await db
                .get()
                .collection(collection.admin)
                .findOne({ email: adminData.email, password: adminData.password });

            if (admin) {
                console.log("Admin login success");
                response.admin = admin;
                response.status = true;
                resolve(response);
            } else {
                console.log("Login Failed");
                resolve({ status: false });
            }
        });
    },

    getAllUsers: () => {
        return new Promise(async (resolve, reject) => {
            let allUsers = await db.get().collection(collections.user).find().toArray();
            resolve(allUsers);
        });
    },

    blockUser: (userId) => {
        return new Promise((resolve, reject) => {
            db.get()
                .collection(collections.user)
                .updateOne(
                    { _id: objectId(userId) },
                    {
                        $set: { block: true },
                    }
                )
                .then((status) => {
                    resolve(status);
                });
        });
    },

    unBlockUser: (userId) => {
        return new Promise((resolve, reject) => {
            db.get()
                .collection(collections.user)
                .updateOne(
                    { _id: objectId(userId) },
                    {
                        $set: { block: false },
                    }
                )
                .then((status) => {
                    resolve(status);
                });
        });
    },

    addCategory: (categoryDetails) => {
        return new Promise(async (resolve, reject) => {
            let existStatus = await db
                .get()
                .collection(collections.category)
                .findOne({ categoryName: categoryDetails.categoryName });
            console.log(existStatus);

            if (existStatus == null) {
                db.get()
                    .collection(collections.category)
                    .insertOne(categoryDetails)
                    .then((response) => {
                        resolve(response);
                    });
            } else {
                resolve({ status: true });
            }
        });
    },

    getAllCategory: () => {
        return new Promise(async (resolve, reject) => {
            let category = await db.get().collection(collections.category).find().toArray();
            resolve(category);
        });
    },

    getProducts: (Category) => {
        return new Promise(async (resolve, reject) => {
            let products = await db
                .get()
                .collection(collections.products)
                .aggregate([
                    {
                        $match: { Category: Category },
                    },
                    {
                        $group: { _id: "$product_name" },
                    },
                ])
                .toArray();
            resolve(products);
        });
    },

    getCategoryDetails: (categoryId) => {
        return new Promise((resolve, reject) => {
            db.get()
                .collection(collections.category)
                .findOne({ _id: objectId(categoryId) })
                .then((category) => {
                    resolve(category);
                });
        });
    },

    updateCategory: (categoryId, categoryDetails) => {
        return new Promise((resolve, reject) => {
            db.get()
                .collection(collections.category)
                .updateOne(
                    { _id: objectId(categoryId) },
                    {
                        $set: {
                            categoryName: categoryDetails.categoryName,
                        },
                    }
                )
                .then((status) => {
                    resolve(status);
                });
        });
    },

    deleteCategory: (categoryId) => {
        return new Promise((resolve, reject) => {
            db.get()
                .collection(collections.category)
                .deleteOne({ _id: objectId(categoryId) })
                .then((response) => {
                    resolve(response);
                });
        });
    },

    addBannerImage: (bannerDetails) => {
        bannerDetails.date = new Date().toString().split("G")[0];

        return new Promise(async (resolve, reject) => {
            let product = await db
                .get()
                .collection(collections.products)
                .findOne({ _id: objectId(bannerDetails.productId) });
            bannerDetails.productName = product.product_name;
            bannerDetails.productPrice = product.Price;
            bannerDetails.productModelName = product.modelname;

            await db
                .get()
                .collection(collections.banner)
                .insertOne(bannerDetails)
                .then((data) => {
                    console.log(data);
                    let id = data.insertedId;
                    resolve(id);
                });
        });
    },

    getBanners: () => {
        return new Promise(async (resolve, reject) => {
            let banners = await db.get().collection(collections.banner).find().toArray();
            if (banners) {
                console.log(banners, "/////////banner details");
                resolve(banners);
            } else {
                resolve({ status: false });
            }
        });
    },

    getOneBanner: (bannerId) => {
        bannerId = objectId(bannerId);
        return new Promise(async (resolve, reject) => {
            await db
                .get()
                .collection(collections.banner)
                .findOne({ _id: bannerId })
                .then((bannerInfo) => {
                    resolve(bannerInfo);
                });
        });
    },
    deleteBanner: (id) => {
        return new Promise((resolve, reject) => {
            db.get()
                .collection(collections.banner)
                .deleteOne({ _id: objectId(id) })
                .then((response) => {
                    resolve(response);
                });
        });
    },

    getAllOrders: () => {
        return new Promise(async (resolve, reject) => {
            let orders = await db
                .get()
                .collection(collections.order)
                .aggregate([
                    {
                        $unwind: "$products",
                    },
                    {
                        $project: {
                            orderId: "$__id",
                            payment: "$payment",
                            deliveryDetails: "$deliveryDetails",
                            userId: "$userId",
                            item: "$products.item",
                            quantity: "$products.quantity",
                            totalPrice: "$totalPrice",
                            ordStatus: "$ordStatus",
                            orderStatus: "$products.orderStatus",
                            shippedStatus: "$products.shippedStatus",
                            deliverStatus: "$products.deliverStatus",
                            orderDate: "$orderDate",
                            cancelDate: "$products.cancelDate",
                            cancel: "$products.cancel",
                            shippedDate: "$products.shippedDate",
                            deliveredDate: "$products.deliveredDate",
                        },
                    },
                    {
                        $lookup: {
                            from: collections.address,
                            localField: "deliveryDetails",
                            foreignField: "_id",
                            as: "address",
                        },
                    },
                    {
                        $lookup: {
                            from: collections.products,
                            localField: "item",
                            foreignField: "_id",
                            as: "product",
                        },
                    },
                    {
                        $project: {
                            userId: 1,
                            deliveryDetails: 1,
                            payment: 1,
                            item: 1,
                            quantity: 1,
                            product: { $arrayElemAt: ["$product", 0] },
                            address: { $arrayElemAt: ["$address", 0] },
                            totalPrice: 1,
                            ordStatus: 1,
                            orderStatus: 1,
                            shippedStatus: 1,
                            deliverStatus: 1,
                            orderDate: 1,
                            cancelDate: 1,
                            cancel: 1,
                            shippedDate: 1,
                            deliveredDate: 1,
                        },
                    },
                ])
                .sort({ _id: -1, orderDate: -1 })
                .toArray();

            resolve(orders);

            // console.log(orders,'/////orders admin side');
        });
    },

    orderCancel: (orderId, itemId) => {
        return new Promise(async (resolve, reject) => {
            let cancelStatus = await db
                .get()
                .collection(collections.order)
                .findOne(
                    { _id: objectId(orderId) },
                    {
                        projection: {
                            products: {
                                $elemMatch: {
                                    item: objectId(itemId),
                                },
                            },
                        },
                    }
                );

            if (!cancelStatus.products.length) {
                // error to notifi the user that the product not found
                resolve(error);
            } else if (cancelStatus.products[0].cancel) {
                resolve({ cancelStatus: true });
            } else {
                await db
                    .get()
                    .collection(collections.order)
                    .updateOne(
                        { _id: objectId(orderId), "products.item": objectId(itemId) },
                        {
                            $set: {
                                "products.$.orderStatus": "Cancelled",
                                "products.$.cancel": true,
                                "products.$.shippedStatus": false,
                                "products.$.deliverStatus": false,
                                "products.$.cancelDate": new Date().toString().split("G")[0],
                            },
                        }
                    )
                    .then((response) => {
                        resolve({ cancelStatus: false });
                    });
            }
        });
    },

    orderShip: (orderId, itemId) => {
        return new Promise(async (resolve, reject) => {
            let orderShipStatus = await db
                .get()
                .collection(collections.order)
                .findOne(
                    { _id: objectId(orderId) },
                    {
                        projection: {
                            products: {
                                $elemMatch: {
                                    item: objectId(itemId),
                                },
                            },
                        },
                    }
                );

            if (!orderShipStatus.products.length) {
                // error to notifi the user that the product not found
                resolve(error);
            } else if (orderShipStatus.products[0].cancel) {
                resolve({ cancelStatus: true });
            } else if (orderShipStatus.products[0].shippedStatus) {
                resolve({ existShippedStatus: true });
            } else if (orderShipStatus.products[0].deliverStatus == null) {
                await db
                    .get()
                    .collection(collections.order)
                    .updateOne(
                        { _id: objectId(orderId), "products.item": objectId(itemId) },
                        {
                            $set: {
                                "products.$.shippedStatus": true,
                                "products.$.shippedDate": new Date().toString().split("G")[0],
                            },
                        }
                    )
                    .then((response) => {
                        resolve({ shippedStatus: true });
                    });
            }
        });
    },

    orderDeliver: (orderId, itemId) => {
        return new Promise(async (resolve, reject) => {
            let orderDeliverStatus = await db
                .get()
                .collection(collections.order)
                .findOne(
                    { _id: objectId(orderId) },
                    {
                        projection: {
                            products: {
                                $elemMatch: {
                                    item: objectId(itemId),
                                },
                            },
                        },
                    }
                );

            if (!orderDeliverStatus.products.length) {
                // error to notifi the user that the product not found
                resolve(error);
            } else if (orderDeliverStatus.products[0].cancel) {
                resolve({ cancelStatus: true });
            } else if (orderDeliverStatus.products[0].deliverStatus) {
                resolve({ existDeliverStatus: true });
            } else if (orderDeliverStatus.products[0].shippedStatus) {
                await db
                    .get()
                    .collection(collections.order)
                    .updateOne(
                        { _id: objectId(orderId), "products.item": objectId(itemId) },
                        {
                            $set: {
                                "products.$.deliverStatus": true,
                                "products.$.deliveredDate": new Date(),
                            },
                        }
                    )
                    .then((response) => {
                        resolve({ deliverStatus: true });
                    });
            } else {
                resolve({ errorStatus: true });
            }
        });
    },

    addProductOffer: (offer) => {
        console.log(offer);
        return new Promise(async (resolve, reject) => {
            let product = offer.product;

            let offerExist = await db
                .get()
                .collection(collections.productOffer)
                .aggregate([
                    {
                        $match: { product: { $regex: product, $options: "i" } },
                    },
                ])
                .toArray();

            if (offerExist[0]) {
                resolve({ Exist: true });
            } else {
                await db
                    .get()
                    .collection(collections.productOffer)
                    .insertOne(offer)
                    .then(async (data) => {
                        let getInsertedOfferData = await db
                            .get()
                            .collection(collections.productOffer)
                            .findOne({ _id: objectId(data.insertedId) });
                        discount = getInsertedOfferData.discount;
                    });
                let comingPercentage = parseInt(discount);
                let ProductName = offer.product;
                productDetails = await db
                    .get()
                    .collection(collections.products)
                    .aggregate([
                        {
                            $match: { product_name: { $regex: ProductName, $options: "i" } },
                        },
                    ])
                    .toArray();

                let activePercentege = productDetails[0].offerPercentage;
                let bestOff = comingPercentage < activePercentege ? activePercentege : comingPercentage;
                if (productDetails[0].offer) {
                    let price = productDetails[0].OldPrice;
                    let offerPrice = price - (price * bestOff) / 100;
                    offerPrice = parseInt(offerPrice.toFixed(0));
                    db.get()
                        .collection(collections.products)
                        .updateOne(
                            {
                                product_name: offer.product,
                            },
                            {
                                $set: {
                                    OldPrice: price,
                                    Price: offerPrice,
                                    offerPercentage: bestOff,
                                    offer: true,
                                    ProductOffer: true,
                                },
                            }
                        );
                } else {
                    let price = productDetails[0].Price;
                    let offerPrice = price - (price * comingPercentage) / 100;
                    offerPrice = parseInt(offerPrice.toFixed(0));

                    db.get()
                        .collection(collections.products)
                        .updateOne(
                            {
                                product_name: offer.product,
                            },
                            {
                                $set: {
                                    OldPrice: price,
                                    Price: offerPrice,
                                    offerPercentage: bestOff,
                                    offer: true,
                                    ProductOffer: true,
                                },
                            }
                        );
                }
            }
            resolve({ Exist: false });
        });
    },

    findProductOffer: () => {
        return new Promise(async (resolve, reject) => {
            let result = await db.get().collection(collections.productOffer).find().toArray();
            resolve(result);
        });
    },

    deleteProductOffer: (offerId, Product) => {
        return new Promise(async (resolve, reject) => {
            let productDetails = await db
                .get()
                .collection(collections.products)
                .aggregate([
                    {
                        $match: { product_name: Product },
                    },
                ])
                .toArray();
            let productPrice = productDetails[0].OldPrice;
            let category = productDetails[0].Category;
            let productName = productDetails[0].product_name;
            let CategoryofferExist = await db.get().collection(collections.categoryOffer).findOne({ offerItem: category });
            if (CategoryofferExist) {
                let percentage = parseInt(CategoryofferExist.discount);
                let price = productDetails[0].OldPrice;
                let offerPrice = price - (price * percentage) / 100;
                db.get()
                    .collection(collections.products)
                    .updateOne(
                        {
                            product_name: productName,
                        },
                        {
                            $set: {
                                OldPrice: price,
                                Price: offerPrice,
                                offerPercentage: percentage,
                                offer: true,
                                ProductOffer: false,
                            },
                        }
                    );

                db.get()
                    .collection(collections.productOffer)
                    .deleteOne({ _id: objectId(offerId) })
                    .then(() => {
                        resolve();
                    });
            } else {
                let proId = productDetails[0]._id + "";

                await db
                    .get()
                    .collection(collections.products)
                    .updateOne(
                        {
                            _id: objectId(proId),
                        },
                        {
                            $set: {
                                Price: productPrice,
                                offer: false,
                                ProductOffer: false,
                            },
                        }
                    );

                db.get()
                    .collection(collections.productOffer)
                    .deleteOne({ _id: objectId(offerId) })
                    .then(() => {
                        resolve();
                    });
            }
        });
    },

    findCategoryOffer: () => {
        return new Promise(async (resolve, reject) => {
            let offerList = await db.get().collection(collections.categoryOffer).find().toArray();
            resolve(offerList);
        });
    },
    addCoupon: (data) => {
        return new Promise((resolve, reject) => {
            db.get()
                .collection(collections.coupon)
                .insertOne(data)
                .then(() => {
                    resolve();
                })
                .catch(() => {
                    reject();
                });
        });
    },

    addCategoryOffer: (offer) => {
        let offerItem = offer.offerItem;

        return new Promise(async (resolve, reject) => {
            let offerExist = await db.get().collection(collections.categoryOffer).findOne({ offerItem: offerItem });

            if (offerExist) {
                resolve({ Exist: true });
            } else {
                db.get()
                    .collection(collections.categoryOffer)
                    .insertOne(offer)
                    .then(async (data) => {
                        let activeOffer = await db
                            .get()
                            .collection(collections.categoryOffer)
                            .findOne({ _id: data.insertedId });

                        let discount = activeOffer.discount;

                        let category = activeOffer.offerItem;
                        if (category === "Standard ") {
                            category = "Standard";
                        } else {
                            category = category;
                        }

                        let items = await db
                            .get()
                            .collection(collections.products)
                            .aggregate([
                                {
                                    $match: { $and: [{ Category: category }, { offer: false }] },
                                },
                            ])
                            .toArray();

                        if (items[0]) {
                            await items.map(async (product) => {
                                let productPrice = product.Price;

                                let offerPrice = productPrice - (productPrice * discount) / 100;
                                offerPrice = parseInt(offerPrice.toFixed(2));
                                let proId = product._id + "";

                                await db
                                    .get()
                                    .collection(collections.products)
                                    .updateOne(
                                        {
                                            _id: objectId(proId),
                                        },
                                        {
                                            $set: {
                                                Price: offerPrice,
                                                offer: true,
                                                OldPrice: productPrice,
                                                offerPercentage: parseInt(discount),
                                            },
                                        }
                                    );
                            });
                        }

                        let Item2 = await db
                            .get()
                            .collection(collections.products)
                            .aggregate([
                                {
                                    $match: {
                                        $and: [{ Category: category }, { ProductOffer: true }],
                                    },
                                },
                            ])
                            .toArray();

                        if (Item2[0]) {
                            await Item2.map(async (product) => {
                                let ProdName = product.product_name;

                                proOFF = await db
                                    .get()
                                    .collection(collections.productOffer)
                                    .aggregate([
                                        {
                                            $match: { product: { $regex: ProdName, $options: "i" } },
                                        },
                                    ])
                                    .toArray();
                                let proOffPercentage = parseInt(proOFF[0].discount);
                                discount = parseInt(discount);
                                let BSToFF = proOffPercentage < discount ? discount : proOffPercentage;
                                let prize = product.OldPrice;
                                let offerrate = prize - (prize * BSToFF) / 100;
                                db.get()
                                    .collection(collections.products)
                                    .updateOne(
                                        {
                                            _id: objectId(product._id),
                                        },
                                        {
                                            $set: {
                                                Price: offerrate,
                                                offer: true,
                                                OldPrice: prize,
                                                offerPercentage: parseInt(BSToFF),
                                            },
                                        }
                                    );
                            });
                        } else {
                        }

                        resolve({ Exist: false });
                    });
            }
        });
    },

    deleteCategoryOffer: (offId, category) => {
        if (category === "Standard ") {
            category = "Standard";
        } else {
            category = category;
        }

        return new Promise(async (resolve, reject) => {
            let items = await db
                .get()
                .collection(collections.products)
                .aggregate([
                    {
                        $match: { $and: [{ Category: category }, { ProductOffer: false }] },
                    },
                ])
                .toArray();

            if (items[0]) {
                await items.map(async (product) => {
                    let productPrice = product.OldPrice;

                    let proId = product._id + "";

                    await db
                        .get()
                        .collection(collections.products)
                        .updateOne(
                            {
                                _id: objectId(proId),
                            },
                            {
                                $set: {
                                    Price: productPrice,
                                    offer: false,
                                },
                            }
                        );
                });
            }

            let itemforUpdate = await db
                .get()
                .collection(collections.products)
                .aggregate([
                    {
                        $match: { $and: [{ Category: category }, { ProductOffer: true }] },
                    },
                ])
                .toArray();

            if (itemforUpdate[0]) {
                await itemforUpdate.map(async (product) => {
                    let proName = product.product_name;
                    let Off = await db
                        .get()
                        .collection(collections.productOffer)
                        .aggregate([
                            {
                                $match: { product: { $regex: proName, $options: "i" } },
                            },
                        ])
                        .toArray();

                    let dis = parseInt(Off[0].discount);
                    let prze = product.OldPrice;
                    let offerPrice = prze - (prze * dis) / 100;

                    db.get()
                        .collection(collections.products)
                        .updateOne(
                            {
                                _id: objectId(product._id),
                            },
                            {
                                $set: {
                                    Price: offerPrice,
                                    offer: true,
                                    OldPrice: prze,
                                    offerPercentage: dis,
                                    ProductOffer: true,
                                },
                            }
                        );
                });
            }

            db.get()
                .collection(collections.categoryOffer)
                .deleteOne({ _id: objectId(offId) })
                .then(() => {
                    resolve();
                });
        });
    },
    getCoupons: () => {
        return new Promise(async (resolve, reject) => {
            db.get()
                .collection(collections.coupon)
                .find()
                .toArray()
                .then((coupons) => {
                    resolve(coupons);
                });
        });
    },

    deleteCoupon: (couponId) => {
        return new Promise((resolve, reject) => {
            db.get()
                .collection(collections.coupon)
                .deleteOne({ _id: objectId(couponId) })
                .then(() => {
                    resolve();
                });
        });
    },

    //admin dashboard chart and graph functions
    getAllUsersCount: () => {
        return new Promise(async (resolve, reject) => {
            try {
                let userCount = await db.get().collection(collections.user).count();
                resolve(userCount);
            } catch (err) {
                console.log(err);
            }
        });
    },
    getTotalProfit: () => {
        return new Promise(async (resolve, reject) => {
            let profit = await db
                .get()
                .collection(collections.order)
                .aggregate([
                    {
                        $match: {
                            "products.deliverStatus": true,
                        },
                    },
                    {
                        $group: {
                            _id: 0,
                            profit: {
                                $sum: "$totalPrice",
                            },
                        },
                    },
                ])
                .toArray();
            resolve(profit[0]?.profit);
        });
    },
    getTotalOrderCount: () => {
        return new Promise(async (resolve, reject) => {
            try {
                let orderCount = await db
                    .get()
                    .collection(collections.order)
                    .find({ "products.deliverStatus": true })
                    .count();
                resolve(orderCount);
            } catch (err) {
                console.log(err);
            }
        });
    },
    getTotalProductCount: () => {
        return new Promise(async (resolve, reject) => {
            try {
                let totalProduct = await db.get().collection(collections.products).find().count();

                resolve(totalProduct);
            } catch (err) {
                console.log(err);
            }
        });
    },
    getAllProducts: () => {
        return new Promise(async (resolve, reject) => {
            try {
                let products = await db.get().collection(collections.products).find().toArray();
                resolve(products);
            } catch (err) {
                console.log(err);
            }
        });
    },

    getCOD_Total: () => {
        return new Promise(async (resolve, reject) => {
            try {
                let COD_Total = await db
                    .get()
                    .collection(collections.order)
                    .aggregate([
                        {
                            $match: {
                                $and: [{ "products.deliverStatus": true }, { payment: "COD" }],
                            },
                        },
                        {
                            $group: {
                                _id: 0,
                                profit: {
                                    $sum: "$totalPrice",
                                },
                            },
                        },
                    ])
                    .toArray();
                resolve(COD_Total[0]?.profit);
            } catch (err) {
                console.log(err);
            }
        });
    },
    getRazorpayTotal: () => {
        return new Promise(async (resolve, reject) => {
            try {
                let razorpayTotal = await db
                    .get()
                    .collection(collections.order)
                    .aggregate([
                        {
                            $match: {
                                $and: [{ "products.deliverStatus": true }, { payment: "Razorpay" }],
                            },
                        },
                        {
                            $group: {
                                _id: 0,
                                profit: {
                                    $sum: "$totalPrice",
                                },
                            },
                        },
                    ])
                    .toArray();
                resolve(razorpayTotal[0]?.profit);
            } catch (err) {
                console.log(err);
            }
        });
    },

    getPaypalTotal: () => {
        return new Promise(async (resolve, reject) => {
            try {
                let paypalTotal = await db
                    .get()
                    .collection(collections.order)
                    .aggregate([
                        {
                            $match: {
                                $and: [{ "products.deliverStatus": true }, { payment: "Paypal" }],
                            },
                        },
                        {
                            $group: {
                                _id: 0,
                                profit: {
                                    $sum: "$totalPrice",
                                },
                            },
                        },
                    ])
                    .toArray();
                resolve(paypalTotal[0]?.profit);
            } catch (err) {
                console.log(err);
            }
        });
    },

    ////////Sales Report
    getSalesReport: () => {
        return new Promise(async (resolve, reject) => {
            try {
                let orderDetails = await db
                    .get()
                    .collection(collections.order)
                    .aggregate([
                        {
                            $match: { "products.deliverStatus": true },
                        },
                        {
                            $project: {
                                orderId: "$_id",
                                userId: "$userId",
                                paymentMethod: "$payment",
                                totalAmount: "$totalPrice",
                                coupon: "$coupon",
                                orderDate: "$orderDate",
                                shippedDate: "$products.shippedDate",
                                deliveredDate: "$products.deliveredDate",
                                productId: "$products.item",
                            },
                        },
                        {
                            $lookup: {
                                from: collections.user,
                                localField: "userId",
                                foreignField: "_id",
                                as: "userName",
                            },
                        },
                        {
                            $lookup: {
                                from: collections.products,
                                localField: "productId",
                                foreignField: "_id",
                                as: "products",
                            },
                        },
                        {
                            $project: {
                                orderId: 1,
                                userName: { $arrayElemAt: ["$userName", 0] },
                                products: { $arrayElemAt: ["$products", 0] },
                                paymentMethod: 1,
                                totalAmount: 1,
                                coupon: 1,
                                orderDate: 1,
                                shippedDate: 1,
                                deliveredDate: 1,
                            },
                        },
                    ])
                    .toArray();
                // console.log(orderDetails,'//////orderDetails');
                resolve(orderDetails);
            } catch (err) {
                console.log(err);
            }
        });
    },

    salesReportGet: (from, to) => {
       var fromDate= new Date(from);
       var toDate= new Date(to);
       toDate.setHours(23)
       toDate.setMinutes(59)
       toDate.setSeconds(59)
       toDate.setMilliseconds(999)
        
        console.log(fromDate, 'from date ');
        console.log(toDate, 'to date');

        return new Promise(async (resolve, reject) => {

            

            let orders = await db.get().collection(collections.order).aggregate([
                // {
                //     $match: {
                       
                //             "products.deliverStatus": true 
                //     }
                    
                // },
                // {
                //     $unwind:"$products"
                // },
                // {
                    // $match:{
                   
                    // "products.deliveredDate":{$gte:fromDate, $lte:toDate},
                    // }
                // }
                {
                    $match: { "products.deliverStatus": true },
                },
                {
                    $unwind: "$products",
                },
                {
                    $project: {
                        orderId: "$_id",
                        userId: "$userId",
                        paymentMethod: "$payment",
                        totalAmount: "$totalPrice",
                        coupon: "$coupon",
                        orderDate: "$orderDate",
                        shippedDate: "$products.shippedDate",
                        deliveredDate: "$products.deliveredDate",
                        productId: "$products.item",
                    },
                },
                {
                    $lookup: {
                        from: collections.user,
                        localField: "userId",
                        foreignField: "_id",
                        as: "userName",
                    },
                },
                {
                    $lookup: {
                        from: collections.products,
                        localField: "productId",
                        foreignField: "_id",
                        as: "products",
                    },
                },
                {
                    $project: {
                        orderId: 1,
                        userName: { $arrayElemAt: ["$userName", 0] },
                        products: { $arrayElemAt: ["$products", 0] },
                        paymentMethod: 1,
                        totalAmount: 1,
                        coupon: 1,
                        orderDate: 1,
                        shippedDate: 1,
                        deliveredDate: 1,
                    },
                },
                {
                    $match:{
                   
                        "deliveredDate":{$gte:fromDate, $lte:toDate},
                        }
                }
            ]).toArray()
            // console.log(orders, 'daily orders');
            resolve(orders)
        })
    },

    getNewSalesReport: (type) => {
        if (type === "monthly") {
            var dt = new Date();
            dt.setDate(dt.getDate() - 30);
        } else if (type === "weekly") {
            var dt = new Date();
            dt.setDate(dt.getDate() - 7);
        } else if (type === "yearly") {
            var dt = new Date();
            dt.setDate(dt.getDate() - 365);
        } else if (type === "daily") {
            var dt = new Date();
            dt.setDate(dt.getDate() - 1);
        } else {
            var dt = new Date();
            dt.setDate(dt.getDate() - 0);
        }

        return new Promise(async (resolve, reject) => {
            const data = await db
                .get()
                .collection(collections.order)
                .aggregate([
                    {
                        $match: { "products.deliverStatus": true },
                    },
                    {
                        $unwind: "$products",
                    },
                    {
                        $project: {
                            orderId: "$_id",
                            userId: "$userId",
                            paymentMethod: "$payment",
                            totalAmount: "$totalPrice",
                            coupon: "$coupon",
                            orderDate: "$orderDate",
                            shippedDate: "$products.shippedDate",
                            deliveredDate: "$products.deliveredDate",
                            productId: "$products.item",
                        },
                    },
                    {
                        $lookup: {
                            from: collections.user,
                            localField: "userId",
                            foreignField: "_id",
                            as: "userName",
                        },
                    },
                    {
                        $lookup: {
                            from: collections.products,
                            localField: "productId",
                            foreignField: "_id",
                            as: "products",
                        },
                    },
                    {
                        $project: {
                            orderId: 1,
                            userName: { $arrayElemAt: ["$userName", 0] },
                            products: { $arrayElemAt: ["$products", 0] },
                            paymentMethod: 1,
                            totalAmount: 1,
                            coupon: 1,
                            orderDate: 1,
                            shippedDate: 1,
                            deliveredDate: 1,
                        },
                    },
                ])
                .toArray();
            console.log(data, "//////data");
            let newData = data.filter(function (e) {
                return e.deliveredDate >= dt;
            });
            resolve(newData);
        });
    },
};
