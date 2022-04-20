var db = require("../config/connection");
var collection = require("../config/collections");
const bcrypt = require("bcrypt");
const collections = require("../config/collections");
var objectId = require("mongodb").ObjectId;
const dotenv = require("dotenv");
dotenv.config();
const { products } = require("../config/collections");
const client = require("twilio")(process.env.accountSID, process.env.authToken);
const Razorpay = require("razorpay");
const { resolve } = require("path");

var instance = new Razorpay({
    key_id: process.env.key_id,
    key_secret: process.env.key_secret,
});

module.exports = {
    doSignup: (userDetails) => {
        return new Promise(async (resolve, reject) => {
            let existStatus = await db
                .get()
                .collection(collections.user)
                .findOne({ $or: [{ email: userDetails.email }, { phoneNumber: userDetails.phoneNumber }] });

            if (existStatus == null) {
                resolve({ status: false });
            } else {
                resolve({ status: true });
            }
        });
    },

    sendOTP: (mobile) => {
        return new Promise(async (resolve, reject) => {
            let userExist = await db.get().collection(collections.user).findOne({ phoneNumber: mobile });
            if (userExist) {
                client.verify
                    .services(process.env.serviceSID)
                    .verifications.create({
                        to: `+91${mobile}`,
                        channel: "sms",
                    })
                    .then((response) => {
                        resolve(response);
                    });
            } else {
                resolve({ OTP: false });
            }
        });
    },

    doRegister: (userDetails) => {
        return new Promise(async (resolve, reject) => {
            userDetails.password = await bcrypt.hash(userDetails.password, 10);
            userDetails.block = false;
            userDetails.dateJoined = new Date().toString().split("G")[0];

            db.get()
                .collection(collection.user)
                .insertOne(userDetails)
                .then((status) => {
                    resolve(status.insertedId);
                });
        });
    },

    doLogin: (loginDetails) => {
        return new Promise(async (resolve, reject) => {
            let response = {
                loginStatus: false,
            };

            let user = await db.get().collection(collection.user).findOne({ email: loginDetails.email });

            if (user) {
                bcrypt.compare(loginDetails.password, user.password).then((status) => {
                    if (user.block == false) {
                        if (status) {
                            response.user = user;
                            response.loginStatus = true;
                            resolve(response);
                        } else {
                            resolve((response.loginStatus = false));
                        }
                    } else {
                        reject((user.block = true));
                    }
                });
            } else {
                resolve((response.loginStatus = false));
            }
        });
    },

    doLoginOTP: (loginDetails) => {
        return new Promise(async (resolve, reject) => {
            let response = {
                loginStatus: false,
            };

            let user = await db.get().collection(collection.user).findOne({ email: loginDetails.email });

            if (user) {
                if (user.block == false) {
                    response.user = user;
                    response.loginStatus = true;
                    resolve(response);
                } else {
                    reject((user.block = true));
                }
            } else {
                resolve((response.loginStatus = false));
            }
        });
    },

    findUser: (mobile) => {
        return new Promise(async (resolve, reject) => {
            await db
                .get()
                .collection(collections.user)
                .findOne({ phoneNumber: mobile })
                .then((userDetails) => {
                    resolve(userDetails);
                });
        });
    },

    getHomePage: () => {
        return new Promise(async (resolve, reject) => {
            let banners = await db.get().collection(collection.banner).find().toArray();
            let banner1 = banners[0];
            let banner2 = banners[1];

            let newLaunch = await db.get().collection(collections.products).find().limit(4).toArray();

            let smartTvs = await db
                .get()
                .collection(collections.products)
                .find({ Category: "Smart Android TV" })
                .limit(4)
                .toArray();

            let standardtvs = await db
                .get()
                .collection(collections.products)
                .find({ Category: "Standard" })
                .limit(4)
                .toArray();

            let homePage = {};
            homePage.newLaunch = newLaunch;
            homePage.smartTvs = smartTvs;
            homePage.standardtvs = standardtvs;
            homePage.banner1 = banner1;
            homePage.banner2 = banner2;
            resolve(homePage);
        });
    },

    addToCart: (proId, userId) => {
        let prodObj = {
            item: objectId(proId),
            quantity: 1,
            cancel: false,
            orderStatus: null,
            shippedStatus: null,
            deliverStatus: null,
            cancelDate: null,
            shippedDate: null,
            deliveredDate: null,
        };
        return new Promise(async (resolve, reject) => {
            let userCart = await db
                .get()
                .collection(collections.cart)
                .findOne({ user: objectId(userId) });
            if (userCart) {
                let proExist = userCart.products.findIndex((product) => product.item == proId);
                if (proExist != -1) {
                    db.get()
                        .collection(collections.cart)
                        .updateOne(
                            { user: objectId(userId), "products.item": objectId(proId) },
                            {
                                $inc: { "products.$.quantity": 1 },
                            }
                        )
                        .then(() => {
                            resolve();
                        });
                } else {
                    db.get()
                        .collection(collections.cart)
                        .updateOne({ user: objectId(userId) }, { $push: { products: prodObj } })
                        .then((response) => {
                            resolve();
                        });
                }
            } else {
                let cartObj = {
                    user: objectId(userId),
                    products: [prodObj],
                };
                db.get()
                    .collection(collections.cart)
                    .insertOne(cartObj)
                    .then((response) => {
                        resolve();
                    });
            }
        });
    },

    getCartProducts: (userId) => {
        return new Promise(async (resolve, reject) => {
            //checking cart already exist or not
            let cartItems = await db
                .get()
                .collection(collections.cart)
                .aggregate([
                    {
                        $match: { user: objectId(userId) },
                    },
                    {
                        $unwind: "$products",
                    },
                    {
                        $project: {
                            item: "$products.item",
                            quantity: "$products.quantity",
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
                            item: 1,
                            quantity: 1,
                            product: { $arrayElemAt: ["$product", 0] },
                        },
                    },
                ])
                .toArray();

            resolve(cartItems);
        });
    },

    getCartCount: (userId) => {
        return new Promise(async (resolve, reject) => {
            let count = 0;
            let cart = await db
                .get()
                .collection(collections.cart)
                .findOne({ user: objectId(userId) });

            if (cart) {
                count = cart.products.length;
            }
            resolve(count);
        });
    },

    changeProductQuantity: (details) => {
        let count = parseInt(details.count);

        return new Promise((resolve, reject) => {
            if (details.count == -1 && details.quantity == 1) {
                db.get()
                    .collection(collections.cart)
                    .updateOne(
                        { _id: objectId(details.cart) },
                        {
                            $pull: { products: { item: objectId(details.product) } },
                        }
                    )
                    .then((response) => {
                        resolve({ removeProduct: true });
                    });
            } else {
                db.get()
                    .collection(collections.cart)
                    .updateOne(
                        { _id: objectId(details.cart), "products.item": objectId(details.product) },
                        {
                            $inc: { "products.$.quantity": count },
                        }
                    )
                    .then((response) => {
                        resolve({ status: true });
                    });
            }
        });
    },

    removeProduct: (details) => {
        return new Promise((resolve, reject) => {
            db.get()
                .collection(collections.cart)
                .updateOne(
                    { _id: objectId(details.cart) },
                    {
                        $pull: { products: { item: objectId(details.product) } },
                    }
                )
                .then((response) => {
                    resolve({ removeProduct: true });
                });
        });
    },

    getTotalAmount: (userId) => {
        return new Promise(async (resolve, reject) => {
            let totalAmt = await db
                .get()
                .collection(collections.cart)
                .aggregate([
                    {
                        $match: { user: objectId(userId) },
                    },
                    {
                        $unwind: "$products",
                    },
                    {
                        $project: {
                            item: "$products.item",
                            quantity: "$products.quantity",
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
                            item: 1,
                            quantity: 1,
                            product: { $arrayElemAt: ["$product", 0] },
                        },
                    },
                    {
                        $group: {
                            _id: null,

                            total: { $sum: { $multiply: ["$quantity", "$product.Price"] } },
                        },
                    },
                ])
                .toArray();

            resolve(totalAmt[0]?.total);
        });
    },

    addUserAddress: (userAddress) => {
        userAddress.userId = objectId(userAddress.userId);
        return new Promise((resolve, reject) => {
            db.get()
                .collection(collections.address)
                .insertOne(userAddress)
                .then((response) => {
                    resolve(response);
                });
        });
    },

    getAllAddress: (userId) => {
        return new Promise(async (resolve, reject) => {
            let address = await db
                .get()
                .collection(collections.address)
                .find({ userId: objectId(userId) })
                .toArray();

            if (typeof address !== "undefined" && typeof address !== "null") {
                resolve(address);
            } else {
                resolve(false);
            }
        });
    },

    getOneAddress: (addressId) => {
        return new Promise(async (resolve, reject) => {
            await db
                .get()
                .collection(collections.address)
                .findOne({ _id: objectId(addressId) })
                .then((userAddressDetails) => {
                    resolve(userAddressDetails);
                });
        });
    },

    editUserAddress: (addressId) => {
        return new Promise(async (resolve, reject) => {
            await db
                .get()
                .collection(collections.address)
                .findOne({ _id: objectId(addressId) })
                .then((addressDetails) => {
                    resolve(addressDetails);
                });
        });
    },

    updateUserAddress: (updateAddress) => {
        let addressId = objectId(updateAddress.addressId);

        return new Promise((resolve, reject) => {
            db.get()
                .collection(collections.address)
                .updateOne(
                    { _id: addressId },
                    {
                        $set: {
                            firstname: updateAddress.firstname,
                            lastname: updateAddress.lastname,
                            email: updateAddress.email,
                            address: updateAddress.address,
                            phoneNumber: updateAddress.phoneNumber,
                            state: updateAddress.state,
                            city: updateAddress.city,
                            pincode: updateAddress.pincode,
                        },
                    },
                    { upsert: true }
                )
                .then((response) => {
                    resolve();
                });
        });
    },

    placeOrder: (order, products, totalPrice) => {
        return new Promise((resolve, reject) => {
            let ordStatus = order.Payment === "COD" ? "placed" : false;
            let orderObj = {
                deliveryDetails: objectId(order.addressId),
                payment: order.Payment,
                userId: objectId(order.userId),
                products: products,
                totalPrice: totalPrice,
                ordStatus: ordStatus,
                orderDate: new Date().toString().split("G")[0],
            };
            if (order.coupon) orderObj.coupon = order.coupon;

            db.get()
                .collection(collections.order)
                .insertOne(orderObj)
                .then((response) => {
                    if (order.Payment == "COD") {
                        db.get()
                            .collection(collections.cart)
                            .deleteOne({ user: objectId(order.userId) });
                    }
                    let orderId = response.insertedId;
                    resolve(orderId);
                });
        });
    },

    getCartProductList: (userId) => {
        return new Promise(async (resolve, reject) => {
            let cart = await db
                .get()
                .collection(collections.cart)
                .findOne({ user: objectId(userId) });
            resolve(cart.products);
        });
    },

    getCart: (userId) => {
        return new Promise((resolve, reject) => {
            let user = db
                .get()
                .collection(collections.cart)
                .findOne({ user: objectId(userId) });
            resolve(user);
        });
    },

    getUserDetails: (userId) => {
        let Id = objectId(userId);
        return new Promise(async (resolve, reject) => {
            await db
                .get()
                .collection(collections.user)
                .findOne({ _id: Id })
                .then((userDetails) => {
                    resolve(userDetails);
                });
        });
    },

    updateUserProfile: (userId, userDetails) => {
        let Id = objectId(userId);
        return new Promise((resolve, reject) => {
            db.get()
                .collection(collections.user)
                .updateOne(
                    { _id: Id },
                    {
                        $set: {
                            firstName: userDetails.firstName,
                            lastName: userDetails.lastName,
                            phoneNumber: userDetails.phoneNumber,
                            dob: userDetails.dob,
                            Amobile: userDetails.Amobile,
                        },
                    },
                    { upsert: true }
                )
                .then((response) => {
                    resolve();
                });
        });
    },

    deleteUserAddress: (addressId) => {
        let Id = objectId(addressId);
        return new Promise((resolve, reject) => {
            db.get()
                .collection(collections.address)
                .deleteOne({ _id: Id })
                .then(() => {
                    resolve();
                });
        });
    },

    getUserOrders: (userId) => {
        return new Promise(async (resolve, reject) => {
            let orders = await db
                .get()
                .collection(collections.order)
                .find({ userId: objectId(userId) })
                .toArray();

            resolve(orders);
        });
    },

    getUserOrderProducts: (userId) => {
        return new Promise(async (resolve, reject) => {
            let viewOrderedProducts = await db
                .get()
                .collection(collections.order)
                .aggregate([
                    {
                        $match: { userId: objectId(userId) },
                    },
                    {
                        $unwind: "$products",
                    },
                    {
                        $project: {
                            userId: "$userId",
                            deliveryDetails: "$deliveryDetails",
                            payment: "$payment",
                            item: "$products.item",
                            quantity: "$products.quantity",
                            totalPrice: "$totalPrice",
                            orderStatus: "$ordStatus",
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
                    {
                        $sort: {
                            _id: -1,
                            orderDate: -1,
                        },
                    },
                ])
                .toArray();

            resolve(viewOrderedProducts);
        });
    },

    userOrderStatus: (orderId, itemId) => {
        return new Promise(async (resolve, reject) => {
            await db
                .get()
                .collection(collections.order)
                .updateOne(
                    { _id: objectId(orderId), "products.item": objectId(itemId) },
                    {
                        $set: {
                            "products.$.orderStatus": "Cancelled",
                            "products.$.cancel": true,
                            "products.$.cancelDate": new Date().toString().split("G")[0],
                        },
                    }
                )
                .then((response) => {
                    resolve();
                });
        });
    },

    generateRazorpay: (orderId, totalPrice) => {
        return new Promise((resolve, reject) => {
            var options = {
                amount: totalPrice * 100,
                currency: "INR",
                receipt: "" + orderId,
            };
            instance.orders.create(options, function (err, order) {
                if (err) {
                } else {
                    resolve(order);
                }
            });
        });
    },

    verifyPayment: (razorpayPaymentDetails) => {
        return new Promise((resolve, reject) => {
            const crypto = require("crypto");
            let hmac = crypto.createHmac("sha256", "ASqGavP7rVsMNKeGxjPlZVxg");
            hmac.update(
                razorpayPaymentDetails["payment[razorpay_order_id]"] +
                    "|" +
                    razorpayPaymentDetails["payment[razorpay_payment_id]"]
            );
            hmac = hmac.digest("hex");
            if (hmac === razorpayPaymentDetails["payment[razorpay_signature]"]) {
                resolve();
            } else {
                reject();
            }
        });
    },

    changePaymentStatus: (orderId, userId) => {
        return new Promise((resolve, reject) => {
            db.get()
                .collection(collections.order)
                .updateOne(
                    { _id: objectId(orderId) },
                    {
                        $set: {
                            ordStatus: "placed",
                        },
                    }
                )
                .then(() => {
                    db.get()
                        .collection(collections.cart)
                        .deleteOne({ user: objectId(userId) });
                    resolve();
                });
        });
    },

    addToWishlist: (proId, userId) => {
        let prodObj = {
            proId: objectId(proId),
        };

        return new Promise(async (resolve, reject) => {
            let userWishlist = await db
                .get()
                .collection(collections.wishlist)
                .findOne({ user: objectId(userId) });

            if (userWishlist !== null) {
                let prodExist = userWishlist.products.findIndex((product) => product.proId == proId);
                if (prodExist != -1) {
                        resolve({ productAdded: false });
                } else {
                    db.get()
                        .collection(collections.wishlist)
                        .updateOne({ user: objectId(userId) }, { $push: { products: prodObj } })
                        .then((response) => {
                            resolve({ productAdded: true });
                        });
                }
            } else {
                let wishlistObj = {
                    user: objectId(userId),
                    products: [prodObj],
                };
                db.get()
                    .collection(collections.wishlist)
                    .insertOne(wishlistObj)
                    .then((response) => {
                        resolve({ productAdded: true });
                    });
            }
        });
    },

    getWishlistCount: (userId) => {
        return new Promise(async (resolve, reject) => {
            let count = 0;
            let wishlist = await db
                .get()
                .collection(collections.wishlist)
                .findOne({ user: objectId(userId) });

            if (wishlist !== null) {
                count = wishlist.products.length;
                resolve(count);
            } else {
                resolve((count = 0));
            }
        });
    },

    getUserWishlist: (userId) => {
        return new Promise(async (resolve, reject) => {
            let userWishlist = await db
                .get()
                .collection(collections.wishlist)
                .findOne({ user: objectId(userId) });

            if (userWishlist !== null) {
                let userWishlist = await db
                    .get()
                    .collection(collections.wishlist)
                    .aggregate([
                        {
                            $match: { user: objectId(userId) },
                        },
                        {
                            $unwind: "$products",
                        },
                        {
                            $project: {
                                proId: "$products.proId",
                            },
                        },
                        {
                            $lookup: {
                                from: collections.products,
                                localField: "proId",
                                foreignField: "_id",
                                as: "product",
                            },
                        },
                        {
                            $project: {
                                proId: 1,
                                product: { $arrayElemAt: ["$product", 0] },
                            },
                        },
                    ])
                    .toArray();
                resolve(userWishlist, "/////////userwishlist");
            } else {
                resolve({ noWishlist: true });
            }
        });
    },

    removeItemWishlist: (wishlistId, proId) => {
        return new Promise(async (resolve, reject) => {
            let userWishlist = await db
                .get()
                .collection(collections.wishlist)
                .findOne({ _id: objectId(wishlistId) });
            if (userWishlist.products.length === 1) {
                db.get()
                    .collection(collections.wishlist)
                    .deleteOne({ _id: objectId(wishlistId) });
                resolve({ removeProduct: true });
            } else {
                db.get() 
                    .collection(collections.wishlist)
                    .updateOne(
                        { _id: objectId(wishlistId) },
                        {
                            $pull: { products: { proId: objectId(proId) } },
                        }
                    )
                    .then((response) => {
                        resolve({ removeProduct: true });
                    });
            }
        });
    },

    getNewLaunches: () => {
        return new Promise(async (resolve, reject) => {
            let newLaunches = await db.get().collection(collections.products).find().toArray();
            resolve(newLaunches);
        });
    },

    viewSmartAndroidTvs: () => {
        return new Promise(async (resolve, reject) => {
            let smartAndroidTvs = await db
                .get()
                .collection(collections.products)
                .find({ Category: "Smart Android TV" })
                .toArray();
            resolve(smartAndroidTvs);
        });
    },

    viewStandardTvs: () => {
        return new Promise(async (resolve, reject) => {
            let standardTvs = await db.get().collection(collections.products).find({ Category: "Standard" }).toArray();
            resolve(standardTvs);
        });
    },

    checkCoupon: (data, userId) => {
        let date = new Date();
        //Parsing First Date
        let dateStart = Date.parse(date);
        return new Promise(async (resolve, reject) => {
            let used = await db
                .get()
                .collection(collections.usedCoupon)
                .findOne({ coupon: data.coupon, userId: objectId(userId) });
            let coupon = await db.get().collection(collections.coupon).find({ coupon: data.coupon }).toArray();

            let discount = parseInt(coupon[0].discount);

            //Parsing Coupon Date
            let dateExpiry = Date.parse(coupon[0].duration);
            if (dateExpiry < dateStart) {
                resolve({ timeout: true });
            } else if (used != null) {
                resolve({ used: true });
            } else {
                db.get()
                    .collection(collections.cart)
                    .updateOne(
                        { user: objectId(userId) },
                        {
                            $set: {
                                coupon: data.coupon,
                                discount: discount,
                                couponApplied: true,
                            },
                        },
                        { upsert: true }
                    )
                    .then((res) => {
                        resolve({ status: true });
                    });
            }
        });
    },

    deleteCoupon: (userId) => {
        return new Promise((resolve, reject) => {
            db.get()
                .collection(collections.cart)
                .updateOne(
                    { user: objectId(userId) },
                    { $unset: { coupon: 1, discount: 1, finalPrice: 1 } }
                )
                .then(() => {
                    resolve();
                });
        });
    },

    useCoupon: (userId, coupon) => {
        return new Promise((resolve, reject) => {
            db.get()
                .collection(collections.usedCoupon)
                .updateOne({ coupon: coupon }, { $push: { userId: objectId(userId) } }, { upsert: true })
                .then(() => {
                    resolve();
                });
        });
    },

    getAllCoupons: () => {
        return new Promise(async (resolve, reject) => {
            let coupon = await db.get().collection(collections.coupon).find().toArray();
            resolve(coupon);
        });
    },

    updateCart: (userId, final, discount) => {
        return new Promise((resolve, reject) => {
            db.get()
                .collection(collections.cart)
                .updateOne(
                    { user: objectId(userId), couponApplied: true },
                    {
                        $set: {
                            finalPrice: final,
                            discount: discount,
                            couponApplied: false,
                            // applied: false,
                        },
                    }
                )
                .then(() => {
                    resolve();
                })
                .catch(() => {
                    reject();
                });
        });
    },

    useCoupon: (userId, coupon) => {
        return new Promise((resolve, reject) => {
            db.get()
                .collection(collections.usedCoupon)
                .updateOne({ coupon: coupon }, { $push: { userId: objectId(userId) } }, { upsert: true })
                .then(() => {
                    resolve();
                });
        });
    },

    orderDetails: (orderId, userId) => {
        return new Promise(async (resolve, reject) => {
            let orderDetail = await db
                .get()
                .collection(collections.order)
                .findOne({ _id: objectId(orderId), userId: objectId(userId) });

            resolve(orderDetail);
        });
    },

    searchProducts: (search) => {
        return new Promise(async (resolve, reject) => {
            try {
                const products = await db
                    .get()
                    .collection(collections.products)
                    .find({
                        product_name: {
                            $regex: search,
                            $options: "i",
                        },
                    })
                    .toArray();

                resolve(products);
            } catch (err) {
                console.error(err);
                reject([]);
            }
        });
    },
    changePassword: (data, userId) => {
        return new Promise((resolve, reject) => {
            db.get()
                .collection(collections.user)
                .findOne({ _id: objectId(userId) })
                .then((user) => {
                    bcrypt.compare(data.currentPassword, user.password).then(async (status) => {
                        if (status) {
                            newPassword = await bcrypt.hash(data.newPassword, 10);

                            await db
                                .get()
                                .collection(collections.user)
                                .updateOne(
                                    { _id: objectId(userId) },
                                    {
                                        $set: {
                                            password: newPassword,
                                        },
                                    }
                                );

                            resolve({ status: true });
                        } else {
                            resolve({ errOccur: true });
                        }
                    });
                });
        });
    },
};
