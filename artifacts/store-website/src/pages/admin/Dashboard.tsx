import { AdminLayout } from "@/components/layout/AdminLayout";
import { useAdminGetStats } from "@workspace/api-client-react";
import { Smartphone, Layers, Users, CreditCard, TrendingUp } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const dummyChartData = [
  { name: '1', uv: 4000 }, { name: '2', uv: 3000 }, { name: '3', uv: 2000 },
  { name: '4', uv: 2780 }, { name: '5', uv: 1890 }, { name: '6', uv: 2390 },
  { name: '7', uv: 3490 }, { name: '8', uv: 4000 }, { name: '9', uv: 3000 },
  { name: '10', uv: 5000 }, { name: '11', uv: 4800 }, { name: '12', uv: 6000 },
];

export default function AdminDashboard() {
  const { data: stats, isLoading } = useAdminGetStats();

  const statCards = [
    { title: "إجمالي التطبيقات", value: stats?.totalApps || 0, icon: Smartphone, color: "from-blue-500 to-cyan-400" },
    { title: "الأقسام", value: stats?.totalCategories || 0, icon: Layers, color: "from-purple-500 to-pink-500" },
    { title: "الاشتراكات النشطة", value: stats?.activeSubscriptions || 0, icon: Users, color: "from-emerald-500 to-green-400" },
    { title: "إجمالي المبيعات", value: stats?.totalSubscriptions || 0, icon: CreditCard, color: "from-orange-500 to-amber-400" },
  ];

  return (
    <AdminLayout>
      <div className="space-y-8">
        
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((stat, i) => (
            <div key={i} className="bg-card border border-border p-6 rounded-2xl relative overflow-hidden group shadow-sm">
              <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${stat.color} opacity-10 rounded-full blur-2xl -mr-10 -mt-10 group-hover:opacity-20 transition-opacity`} />
              
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.color} bg-opacity-10 shadow-inner`}>
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
                <div className="flex items-center gap-1 text-emerald-600 text-sm font-bold bg-emerald-50 px-2 py-1 rounded-lg">
                  <TrendingUp className="w-3 h-3" /> +12%
                </div>
              </div>
              
              <div>
                <h3 className="text-muted-foreground font-medium mb-1">{stat.title}</h3>
                <p className="text-3xl font-black">
                  {isLoading ? <span className="animate-pulse bg-muted w-16 h-8 block rounded-md" /> : stat.value.toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Chart Section */}
        <div className="bg-card border border-border p-6 rounded-2xl shadow-sm">
          <div className="mb-6 flex justify-between items-end">
            <div>
              <h2 className="text-xl font-bold mb-1">أداء المتجر</h2>
              <p className="text-sm text-muted-foreground">نظرة عامة على الاشتراكات الجديدة خلال آخر 12 شهر</p>
            </div>
          </div>
          
          <div className="h-[300px] w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dummyChartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value/1000}k`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', borderRadius: '12px', direction: 'rtl', color: 'hsl(var(--foreground))' }}
                  itemStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Area type="monotone" dataKey="uv" stroke="hsl(var(--primary))" strokeWidth={3} fillOpacity={1} fill="url(#colorUv)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </AdminLayout>
  );
}
