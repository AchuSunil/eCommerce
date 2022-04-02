const express = require("express");
const router = express.Router();

const productHelpers = require("../helpers/product-helpers");
const adminHelpers = require("../helpers/admin-helpers");
const fs = require("fs");

const { verifyLoginAdmin } = require("../config/middlewares");
const { userInfo } = require("os");

/* GET users listing. */
router.get("/", function (req, res, next) {
    if (req.session.admin) {
        res.redirect("/admin/dashboard");
    }
    res.render("admin/login/admin_loginpage", { admin: true, login: true });
});

//admin loggedin to Dashboard
router.post("/login", function (req, res) {
    console.log(req.body);

    adminHelpers.adminLogin(req.body).then(async (response) => {
        if (response.status) {
            req.session.admin = response.admin;

            let totalUsersCount = await adminHelpers.getAllUsersCount();
            let profit = await adminHelpers.getTotalProfit();
            let totalOrders = await adminHelpers.getTotalOrderCount();
            let totalProductCount = await adminHelpers.getTotalProductCount();
            let products = await adminHelpers.getAllProducts();
            let razorpayTotal = await adminHelpers.getRazorpayTotal();
            let COD_Total = await adminHelpers.getCOD_Total();
            let paypalTotal = await adminHelpers.getPaypalTotal();

            res.render("admin/dashboard/admin-dashboard", {
                admin: true,
                totalUsersCount,
                profit,
                totalOrders,
                totalProductCount,
                products,
                razorpayTotal,
                COD_Total,
                paypalTotal,
            });
        } else {
            res.redirect("/admin");
        }
    });
});

//Dashboard Router
router.get("/dashboard", verifyLoginAdmin, (req, res) => {
    res.render("admin/dashboard/admin-dashboard", { admin: true });
});

///logout router
router.get("/logout", (req, res) => {
    req.session.admin = null;
    res.redirect("/admin");
});

//add-products Router
router.get("/add-product", verifyLoginAdmin, (req, res) => {
    adminHelpers.getAllCategory().then((category) => {
        let viewProductsBtn = true;
        res.render("admin/products/add-product", { admin: true, category, viewProductsBtn });
    });
});

//product moving to server folder
router.post("/add-product", verifyLoginAdmin, (req, res) => {
    console.log(req.body);
    console.log(req.files.image);

    productHelpers.addProduct(req.body).then((response) => {
        let id = response;
        let image = req.files.image;
        image.mv("./public/product-images/" + id + ".jpg", (err) => {
            if (!err) {
                res.redirect("/admin/add-product");
            } else {
                console.log(err);
            }
        });
    });
});

//view products Router
router.get("/view-products", verifyLoginAdmin, (req, res) => {
    productHelpers.getAllProducts().then((products) => {
        res.render("admin/products/view-products", { admin: true, products });
    });
});

//view update-product page Router
router.get("/edit-product/:id", verifyLoginAdmin, async (req, res) => {
    let product = await productHelpers.getProductDetails(req.params.id);
    adminHelpers.getAllCategory().then((category) => {
        res.render("admin/products/edit-product", { admin: true, product, category });
    });
});

//posting updated product data Router
router.post("/update-product/:id", verifyLoginAdmin, (req, res) => {
    let id = req.params.id;
    productHelpers.updateProduct(id, req.body).then(() => {
        if (req.files && req.files.image) {
            let image = req.files.image;
            image.mv("./public/product-images/" + id + ".jpg");
        }
        res.redirect("/admin/view-products");
    });
});

//Delete-product Router
router.get("/delete-product/:id", verifyLoginAdmin, (req, res) => {
    let proId = req.params.id;
    productHelpers.deleteProduct(proId).then((response) => {
        console.log(response);
        res.redirect("/admin/view-products");
    });
});

//user-table Router
router.get("/view-user", verifyLoginAdmin, (req, res) => {
    adminHelpers.getAllUsers().then((allUsers) => {
        console.log(allUsers);
        res.render("admin/user/user-list", { admin: true, allUsers });
    });
});

//Block user Router
router.get("/block-user/:id", verifyLoginAdmin, (req, res) => {
    adminHelpers.blockUser(req.params.id).then((status) => {
        console.log(status);
        res.redirect("/admin/view-user");
    });
});

//Block user Router
router.get("/unblock-user/:id", verifyLoginAdmin, (req, res) => {
    adminHelpers.unBlockUser(req.params.id).then((status) => {
        console.log(status);
        res.redirect("/admin/view-user");
    });
});

//view add-category Router
router.get("/add-category", verifyLoginAdmin, (req, res) => {
    if (req.session.categoryErr) {
        req.session.categoryErr = false;
        let errMsg = "*Already Exists";
        res.render("admin/category/add-category", { admin: true, errMsg });
    } else {
        res.render("admin/category/add-category", { admin: true });
    }
});

//post add-category Router
router.post("/add-category", verifyLoginAdmin, (req, res) => {
    adminHelpers.addCategory(req.body).then((response) => {
        console.log(response.status);
        if (response.status) {
            req.session.categoryErr = true;
            res.redirect("/admin/add-category");
        } else {
            console.log(response);
            res.redirect("/admin/add-category");
        }
    });
});

//view categories Router
router.get("/view-category", verifyLoginAdmin, (req, res) => {
    adminHelpers.getAllCategory().then((category) => {
        res.render("admin/category/view-category", { admin: true, category });
    });
});

//update categories Router
router.get("/update-category/:id", verifyLoginAdmin, async (req, res) => {
    let category = await adminHelpers.getCategoryDetails(req.params.id);
    res.render("admin/category/update-category", { admin: true, category });
});

//update categories Router
router.post("/update-category/:id", verifyLoginAdmin, async (req, res) => {
    adminHelpers.updateCategory(req.params.id, req.body).then((status) => {
        console.log(status);
        res.redirect("/admin/view-category");
    });
});

//Delete-category Router
router.get("/delete-category/:id", verifyLoginAdmin, (req, res) => {
    let categoryId = req.params.id;
    adminHelpers.deleteCategory(categoryId).then((response) => {
        res.redirect("/admin/view-category");
    });
});

//Banner List View Management Router
router.get("/view-bannerList", verifyLoginAdmin, (req, res) => {
    adminHelpers.getBanners().then((bannerDetails) => {
        res.render("admin/banner/view-bannerDetails", { admin: true, bannerDetails });
    });
});

//Add Banner for a Product Router
router.get("/bannerImages", verifyLoginAdmin, (req, res) => {
    productHelpers.getAllProducts().then((productDetails) => {
        res.render("admin/banner/add-banner", { admin: true, productDetails });
    });
});

//Add Banner Images Router
router.get("/add-bannerImg/:id", verifyLoginAdmin, (req, res) => {
    let productId = req.params.id;
    res.render("admin/banner/add-bannerImg", { admin: true, productId });
});

//Add Banner Image Post Router
router.post("/add-bannerImg", verifyLoginAdmin, (req, res) => {
    adminHelpers.addBannerImage(req.body).then((bannerId) => {
        let id = bannerId;
        let bannerImage = req.files.bannerImage;
        bannerImage.mv("./public/Banner-Images/" + id + ".jpg", (err) => {
            if (!err) {
                res.redirect("/admin/bannerImages");
            } else {
                console.log(err);
            }
        });
    });
});

// //view Update Banner image Router
router.get("/update-bannerImg/:id", verifyLoginAdmin, (req, res) => {
    console.log(req.params.id);
    adminHelpers.getOneBanner(req.params.id).then((bannerInfo) => {
        let bannerId = bannerInfo._id;
        res.render("admin/banner/update-bannerImg", { admin: true, bannerId });
    });
});

//update Banner Image
router.post("/update-bannerImg/:id", verifyLoginAdmin, (req, res) => {
    let id = req.params.id;
    if (req.files && req.files.bannerImage) {
        let bannerImage = req.files.bannerImage;
        bannerImage.mv("./public/Banner-Images/" + id + ".jpg");
    }
    res.redirect("/view-bannerList");
});

//Delete Banner Image
router.get("/delete-banner/:id", verifyLoginAdmin, (req, res) => {
    let id = req.params.id;
    adminHelpers.deleteBanner(id).then((response) => {
        path = "./public/Banner-Images/" + id + ".jpg";
        fs.unlinkSync(path);
        console.log(response);
        res.redirect("/admin/view-bannerList");
    });
});

//router for order management
router.get("/view-orders", verifyLoginAdmin, async (req, res) => {
    await adminHelpers.getAllOrders().then((orders) => {
        res.render("admin/orders/order_table", { admin: true, orders });
    });
});

///order Cancel
router.post("/orderCancel", verifyLoginAdmin, async (req, res) => {
    await adminHelpers.orderCancel(req.body.orderId, req.body.itemId).then((status) => {
        if (status.cancelStatus) {
            res.json({ status: false });
        } else {
            res.json({ status: true });
        }
    });
});

///order Ship
router.post("/orderShip", verifyLoginAdmin, async (req, res) => {
    await adminHelpers.orderShip(req.body.orderId, req.body.itemId).then((status) => {
        if (status.cancelStatus) {
            res.json({ cancelStatus: true });
        } else if (status.existShippedStatus) {
            res.json({ existShippedStatus: true });
        } else {
            res.json({ shippedStatus: true });
        }
    });
});

///order Deliver
router.post("/orderDeliver", verifyLoginAdmin, async (req, res) => {
    await adminHelpers.orderDeliver(req.body.orderId, req.body.itemId).then((status) => {
        if (status.cancelStatus) {
            res.json({ cancelStatus: true });
        } else if (status.existDeliverStatus) {
            res.json({ existDeliverStatus: true });
        } else if (status.deliverStatus) {
            res.json({ deliverStatus: true });
        } else {
            res.json({ errorStatus: true });
        }
    });
});

//view product offer && add product offer showing router
router.get("/product-offers", verifyLoginAdmin, async (req, res) => {
    await adminHelpers.getAllCategory().then(async (Categories) => {
        let findProductOffer = await adminHelpers.findProductOffer();

        res.render("admin/product-offer/product-offer", { admin: true, Categories, findProductOffer });
    });
});

//ajax call form product offer hbs for view all products
router.get("/getAllProducts", verifyLoginAdmin, async (req, res) => {
    let products = await adminHelpers.getProducts(req.query.Category);
    res.json(products);
});

///ajax call from product offer hbs to insert product offer details
router.post("/product-offer", verifyLoginAdmin, (req, res) => {
    adminHelpers.addProductOffer(req.body).then((offer) => {
        res.json(offer);
    });
});

//delete productOffer Router
router.post("/deleteProductOffer", verifyLoginAdmin, (req, res) => {
    adminHelpers.deleteProductOffer(req.body.productOfferId, req.body.product);
    res.json({ status: true });
});

//Router for category offers
router.get("/category-offers", verifyLoginAdmin, async (req, res) => {
    await adminHelpers.getAllCategory().then(async (categories) => {
        let findCategoryOffer = await adminHelpers.findCategoryOffer();
        res.render("admin/category-offer/category-offer", { admin: true, categories, findCategoryOffer });
    });
});

//post router for add category offer in category collection
router.post("/category-offer", verifyLoginAdmin, async (req, res) => {
    console.log(req.body, "////////data from category offer");
    let viewPro = await adminHelpers.addCategoryOffer(req.body);
    res.json(viewPro);
});

//Router for delete categry offer
router.post("/deleteOffer", verifyLoginAdmin, async (req, res) => {
    let response = await adminHelpers.deleteCategoryOffer(req.body.catOfferId, req.body.offerItem);
    res.json({ status: true });
});
//router for coupon page
router.get("/coupon", verifyLoginAdmin, async (req, res) => {
    let couponView = await adminHelpers.getCoupons();

    res.render("admin/coupon/coupon", { admin: true, couponErr: req.session.couponErr, couponView });
    req.session.couponErr = false;
});

//router for delete coupon at admin side
router.post("/deleteCoupon", verifyLoginAdmin, async (req, res) => {
    await adminHelpers.deleteCoupon(req.body.couponId).then(() => {
        res.json(true);
    });
});
//router for add coupon
router.post("/add-coupon", verifyLoginAdmin, (req, res) => {
    adminHelpers
        .addCoupon(req.body)
        .then(() => {
            res.redirect("/admin/coupon");
        })
        .catch(() => {
            req.session.couponErr = "Coupon Already Exists";
            res.redirect("/admin/coupon");
        });
});
//Router for Sales Report
router.get('/salesReport',verifyLoginAdmin, async (req, res) => {
    let orderDetails = await adminHelpers.getSalesReport()
    
    res.render('admin/Sales-report/salesReport', { admin: true,orderDetails})
})

// router for sort the sales report with from and to date
router.post('/salesreport/report',verifyLoginAdmin, async (req, res) => {
  
    let salesReport = await adminHelpers.salesReportGet(req.body.from, req.body.to);
    console.log(salesReport,'//////salesreport');
   
    res.json({ report: salesReport })
})

//router for sort the sales report on monthly view
router.post('/salesreport/monthlyreport',verifyLoginAdmin,async(req, res) => {
 

    let singleReport = await adminHelpers.getNewSalesReport(req.body.type)
    
    res.json({ wmyreport: singleReport })
})

module.exports = router;
